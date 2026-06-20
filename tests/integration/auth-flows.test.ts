import { beforeAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";

import { hashToken } from "@/lib/tokens";
import { ensureIdentity } from "@/services/identity";
import {
  approveJoinRequest,
  createDirectInvite,
  enableOpenJoin,
  listJoinRequests,
  redeemInvitation,
  requestOpenJoin,
} from "@/services/invitations";
import { consumeMagicLink, mintMagicLink } from "@/services/magic-link";
import { loginWithOAuth, type OAuthProfile } from "@/services/oauth";
import { createTrip } from "@/services/trips";
import type { Identity } from "@/payload-types";

import { createTestUser, ensureCollections, getTestPayload } from "./helpers";

let payload: Payload;
let seq = 0;
const email = (label: string) => `${label}-${++seq}-${Date.now()}@chata.test`;

beforeAll(async () => {
  payload = await getTestPayload();
  await ensureCollections(payload);
}, 120_000);

describe("magic-link auth (T-103)", () => {
  it("provisions an Identity on first redemption", async () => {
    const addr = email("magic-new");
    const { token } = await mintMagicLink(payload, addr);
    const result = await consumeMagicLink(payload, token);
    expect(result.created).toBe(true);
    expect(result.identity.email).toBe(addr);
  });

  it("rejects a reused token (replay protection)", async () => {
    const { token } = await mintMagicLink(payload, email("magic-replay"));
    await consumeMagicLink(payload, token);
    await expect(consumeMagicLink(payload, token)).rejects.toMatchObject({ code: "used_token" });
  });

  it("rejects an expired token", async () => {
    const addr = email("magic-expired");
    const { token } = await mintMagicLink(payload, addr);
    const found = await payload.find({
      collection: "login-tokens",
      where: { tokenHash: { equals: hashToken(token) } },
      overrideAccess: true,
      limit: 1,
    });
    await payload.update({
      collection: "login-tokens",
      id: found.docs[0]!.id,
      overrideAccess: true,
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
    });
    await expect(consumeMagicLink(payload, token)).rejects.toMatchObject({ code: "expired_token" });
  });

  it("rejects an unknown token", async () => {
    await expect(consumeMagicLink(payload, "not-a-real-token")).rejects.toMatchObject({
      code: "invalid_token",
    });
  });

  it("resolves a pending invitation when the invitee signs in by magic link", async () => {
    const organizer = (await createTestUser(payload)) as Identity;
    const { trip } = await createTrip(payload, { name: "Magic resolve", shortName: "MR" }, organizer);
    const inviteeEmail = email("magic-invitee");
    await createDirectInvite(payload, {
      tripId: String(trip.id),
      targetType: "email",
      targetValue: inviteeEmail,
      displayName: "Invited Person",
    });

    const { token } = await mintMagicLink(payload, inviteeEmail);
    const result = await consumeMagicLink(payload, token);

    expect(result.activatedMemberships).toHaveLength(1);
    const membership = result.activatedMemberships[0]!;
    expect(membership.status).toBe("active");
    const ref = membership.identity;
    const memberIdentityId = typeof ref === "object" && ref ? ref.id : ref;
    expect(String(memberIdentityId)).toBe(String(result.identity.id));
  });
});

describe("direct invitations (T-104)", () => {
  it("redeems a token into an active membership, then rejects reuse", async () => {
    const organizer = (await createTestUser(payload)) as Identity;
    const { trip } = await createTrip(payload, { name: "Direct", shortName: "DR" }, organizer);
    const inviteeEmail = email("invitee");
    const { token, membership } = await createDirectInvite(payload, {
      tripId: String(trip.id),
      targetType: "email",
      targetValue: inviteeEmail,
    });
    expect(membership.status).toBe("pending");

    const redeemed = await redeemInvitation(payload, token);
    expect(redeemed.created).toBe(true);
    expect(redeemed.membership.status).toBe("active");
    expect(redeemed.identity.email).toBe(inviteeEmail);

    await expect(redeemInvitation(payload, token)).rejects.toMatchObject({ code: "used_token" });
  });

  it("lets a signed-in user redeem an email invite addressed to their own email", async () => {
    const organizer = (await createTestUser(payload)) as Identity;
    const { trip } = await createTrip(payload, { name: "Self", shortName: "SE" }, organizer);
    const inviteeEmail = email("self-invitee");
    const { token } = await createDirectInvite(payload, {
      tripId: String(trip.id),
      targetType: "email",
      targetValue: inviteeEmail,
    });

    // The invitee already has an account and is signed in when they click.
    const invitee = (await ensureIdentity(payload, { email: inviteeEmail })).identity;
    const redeemed = await redeemInvitation(payload, token, { identity: invitee });
    expect(redeemed.created).toBe(false);
    expect(redeemed.membership.status).toBe("active");
    expect(String(redeemed.identity.id)).toBe(String(invitee.id));
  });

  it("refuses an email invite when signed in as a different user, leaving it usable", async () => {
    const organizer = (await createTestUser(payload)) as Identity;
    const { trip } = await createTrip(payload, { name: "Mismatch", shortName: "MM" }, organizer);
    const inviteeEmail = email("intended");
    const { token, membership } = await createDirectInvite(payload, {
      tripId: String(trip.id),
      targetType: "email",
      targetValue: inviteeEmail,
    });

    // A bystander signed in as someone else clicks the invite link.
    const bystander = (await ensureIdentity(payload, { email: email("bystander") })).identity;
    await expect(
      redeemInvitation(payload, token, { identity: bystander }),
    ).rejects.toMatchObject({ code: "wrong_account" });

    // The pending membership was not hijacked and the invite still works for the
    // intended recipient afterwards.
    const stillPending = await payload.findByID({
      collection: "memberships",
      id: membership.id,
      overrideAccess: true,
    });
    expect(stillPending.status).toBe("pending");
    expect(stillPending.identity ?? null).toBeNull();

    const redeemed = await redeemInvitation(payload, token);
    expect(redeemed.identity.email).toBe(inviteeEmail);
    expect(redeemed.membership.status).toBe("active");
  });
});

describe("open-join with approval (T-104)", () => {
  it("requires organizer approval by default", async () => {
    const organizer = (await createTestUser(payload)) as Identity;
    const { trip } = await createTrip(payload, { name: "Open join", shortName: "OJ" }, organizer);
    const { token } = await enableOpenJoin(payload, String(trip.id));

    const joiner = (await ensureIdentity(payload, { email: email("joiner") })).identity;
    const requested = await requestOpenJoin(payload, token, joiner);
    expect(requested.needsApproval).toBe(true);
    expect(requested.membership.status).toBe("pending");

    const queue = await listJoinRequests(payload, String(trip.id));
    expect(queue.map((m) => String(m.id))).toContain(String(requested.membership.id));

    const approved = await approveJoinRequest(payload, String(requested.membership.id));
    expect(approved.status).toBe("active");
  });

  it("auto-accepts when the trip opts in", async () => {
    const organizer = (await createTestUser(payload)) as Identity;
    const { trip } = await createTrip(payload, { name: "Auto join", shortName: "AJ" }, organizer);
    const { token } = await enableOpenJoin(payload, String(trip.id), { autoAccept: true });

    const joiner = (await ensureIdentity(payload, { email: email("autojoiner") })).identity;
    const requested = await requestOpenJoin(payload, token, joiner);
    expect(requested.needsApproval).toBe(false);
    expect(requested.membership.status).toBe("active");
  });

  it("rejects a disabled open-join link", async () => {
    const joiner = (await ensureIdentity(payload, { email: email("late") })).identity;
    await expect(requestOpenJoin(payload, "bogus-token", joiner)).rejects.toMatchObject({
      code: "open_join_disabled",
    });
  });
});

describe("OAuth login (T-102)", () => {
  const profile = (provider: "google" | "microsoft", addr: string): OAuthProfile => ({
    provider,
    providerAccountId: `${provider}-${addr}`,
    email: addr,
    emailVerified: true,
    name: "OAuth User",
  });

  it("resolves Google and Microsoft logins for one verified email to one Identity", async () => {
    const addr = email("oauth");
    const google = await loginWithOAuth(payload, profile("google", addr));
    expect(google.created).toBe(true);

    const microsoft = await loginWithOAuth(payload, profile("microsoft", addr));
    expect(microsoft.created).toBe(false);
    expect(String(microsoft.identity.id)).toBe(String(google.identity.id));
    expect(microsoft.identity.providers?.map((p) => p.provider).sort()).toEqual([
      "google",
      "microsoft",
    ]);
  });

  it("resolves by provider account id even after the email changes", async () => {
    const addr = email("oauth-rekey");
    const first = await loginWithOAuth(payload, profile("google", addr));
    // Same Google account (same providerAccountId), but a different email now.
    const moved = { ...profile("google", addr), email: email("oauth-rekey-new") };
    const second = await loginWithOAuth(payload, moved);
    expect(second.created).toBe(false);
    expect(String(second.identity.id)).toBe(String(first.identity.id));
  });

  it("refuses an unverified OAuth email", async () => {
    const bad = { ...profile("google", email("unverified")), emailVerified: false };
    await expect(loginWithOAuth(payload, bad)).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("backfills a missing display name on a later login that supplies one", async () => {
    const addr = email("oauth-noname");
    // First login with no name (e.g. Microsoft userinfo omitting it) → email-only.
    const first = await loginWithOAuth(payload, { ...profile("microsoft", addr), name: undefined });
    expect(first.identity.displayName).toBeFalsy();
    // A later login that does carry a name fills it in (self-heal).
    const second = await loginWithOAuth(payload, { ...profile("google", addr), name: "Vojtěch Zicha" });
    expect(String(second.identity.id)).toBe(String(first.identity.id));
    expect(second.identity.displayName).toBe("Vojtěch Zicha");
  });
});
