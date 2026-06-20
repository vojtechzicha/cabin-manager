"use server";

/**
 * Server Actions for the organizer console (T-201) and the lifecycle/info
 * surfaces (T-202/T-203). Every action is reachable by direct POST, so each one
 * re-checks auth: `requireIdentity` for a session, and `requireOrganizer` for
 * trip-scoped writes (organizer/co-organizer only). The math and persistence
 * live in the services; these just authorize, call in, and revalidate.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Payload } from "payload";

import type { Identity } from "@/payload-types";
import { createDirectInvite, approveJoinRequest, disableOpenJoin, enableOpenJoin } from "@/services/invitations";
import {
  transitionArea,
  transitionPhase,
  type AreaKind,
  type AreaStates,
  type TripPhase,
} from "@/services/lifecycle";
import { upsertTripContent, type TripContentData } from "@/services/trip-content";
import { deriveIban, isValidCzAccount, isValidIban, normalizeIban } from "@/services/banking";
import {
  addOption,
  castVote,
  closeDatePoll,
  closeLocationPoll,
  moderateOption,
  publishPoll,
  removeOption,
  reopenPoll,
  setPollMethod,
  type AvailabilityValue,
  type PollKind,
  type PollMethod,
} from "@/services/polls";
import {
  createTrip,
  getMembership,
  identityOrganizesTrip,
  setBanker,
  setMembershipRole,
  updateTripConfig,
} from "@/services/trips";

import { getCurrentIdentity, requireIdentity } from "../auth/current-user";
import type { FormState } from "./form-state";

/**
 * If the form carried a cover-photo file, upload it to the Media collection
 * (stored in MongoDB/GridFS) and return its id; `"clear"` when the organizer
 * removed the cover; `undefined` when unchanged.
 */
async function handleCover(
  payload: Payload,
  formData: FormData,
): Promise<string | "clear" | undefined> {
  const file = formData.get("cover");
  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await payload.create({
      collection: "media",
      overrideAccess: true,
      data: { alt: str(formData.get("name")) ?? "Trip cover" },
      file: { data: buffer, name: file.name, mimetype: file.type || "image/jpeg", size: file.size },
    });
    return String(media.id);
  }
  if (formData.get("coverCleared") === "1") return "clear";
  return undefined;
}

/** Authorize the current Identity as an organizer of `tripId`, or throw. */
async function requireOrganizer(tripId: string): Promise<{ payload: Payload; identity: Identity }> {
  const { payload, identity } = await getCurrentIdentity();
  if (!identity) redirect(`/sign-in?next=${encodeURIComponent(`/trips/${tripId}`)}`);
  if (!(await identityOrganizesTrip(payload, tripId, identity.id))) {
    throw new Error("Not authorized: organizers only.");
  }
  return { payload, identity };
}

/** Authorize the current Identity as an active member of `tripId`, or throw. */
async function requireMember(
  tripId: string,
): Promise<{ payload: Payload; identity: Identity; membershipId: string }> {
  const { payload, identity } = await getCurrentIdentity();
  if (!identity) redirect(`/sign-in?next=${encodeURIComponent(`/trips/${tripId}`)}`);
  const membership = await getMembership(payload, tripId, identity.id);
  if (!membership || membership.status !== "active") {
    throw new Error("Not authorized: trip members only.");
  }
  return { payload, identity, membershipId: String(membership.id) };
}

const str = (v: FormDataEntryValue | null): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : undefined;
};

// --- Trip creation & configuration ------------------------------------------

export async function createTripAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { payload, identity } = await requireIdentity("/trips/new");
  const name = str(formData.get("name"));
  const shortName = str(formData.get("shortName"));
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "required";
  if (!shortName) fieldErrors.shortName = "required";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const cover = await handleCover(payload, formData);
  const { trip } = await createTrip(
    payload,
    {
      name: name!,
      shortName: shortName!,
      location: str(formData.get("location")),
      description: str(formData.get("description")),
      theme: {
        color: str(formData.get("accent")),
        icon: str(formData.get("icon")),
        coverMedia: cover === "clear" ? null : cover,
      },
    },
    identity,
  );

  revalidatePath("/");
  redirect(`/trips/${trip.id}`);
}

export async function saveTripConfigAction(
  tripId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload } = await requireOrganizer(tripId);
  const name = str(formData.get("name"));
  const shortName = str(formData.get("shortName"));
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "required";
  if (!shortName) fieldErrors.shortName = "required";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const cover = await handleCover(payload, formData);
  const area = (k: string) => formData.get(k) === "on";

  await updateTripConfig(payload, tripId, {
    name,
    shortName,
    location: str(formData.get("location")) ?? null,
    description: str(formData.get("description")) ?? null,
    theme: {
      color: str(formData.get("accent")),
      icon: str(formData.get("icon")),
      ...(cover !== undefined ? { coverMedia: cover === "clear" ? null : cover } : {}),
    },
    enabledAreas: {
      voting: area("voting"),
      sleeping: area("sleeping"),
      transport: area("transport"),
      lists: area("lists"),
      finances: area("finances"),
      deposit: area("deposit"),
    },
    // Enabling the "deposit" area also turns deposit-to-confirm on (PRD §8.3.2).
    deposit: { enabled: area("deposit") },
  });

  revalidatePath(`/trips/${tripId}/settings`);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/** Assign the banker + their account; auto-computes the IBAN and validates both. */
export async function setBankerAction(
  tripId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload } = await requireOrganizer(tripId);
  const membershipId = str(formData.get("banker"));
  if (!membershipId) return { fieldErrors: { banker: "required" } };

  const account = str(formData.get("bankAccount"));
  let iban = str(formData.get("iban"));
  const fieldErrors: Record<string, string> = {};
  if (account && !isValidCzAccount(account)) fieldErrors.bankAccount = "invalidAccount";
  if (iban && !isValidIban(iban)) fieldErrors.iban = "invalidIban";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  if (!iban && account) iban = deriveIban(account) ?? undefined; // auto-compute from account
  if (iban) iban = normalizeIban(iban);

  await setBanker(payload, tripId, {
    membershipId,
    bankAccount: account ?? null,
    iban: iban ?? null,
  });
  revalidatePath(`/trips/${tripId}/settings`);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, message: iban }; // surface the computed IBAN to the form
}

// --- Lifecycle (T-202) ------------------------------------------------------

export async function transitionPhaseAction(tripId: string, to: TripPhase): Promise<void> {
  const { payload, identity } = await requireOrganizer(tripId);
  await transitionPhase(payload, tripId, to, { actor: identity.id });
  revalidatePath(`/trips/${tripId}`);
}

export async function transitionAreaAction(
  tripId: string,
  area: AreaKind,
  to: AreaStates[AreaKind],
): Promise<void> {
  const { payload, identity } = await requireOrganizer(tripId);
  await transitionArea(payload, tripId, area, to, { actor: identity.id });
  revalidatePath(`/trips/${tripId}`);
}

// --- People & invitations (T-104/T-201) -------------------------------------

/** Returns the raw invite URL so the organizer can copy/share it. */
export async function createInviteAction(
  tripId: string,
  _prev: { url?: string; error?: string } | null,
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const { payload } = await requireOrganizer(tripId);
  const email = str(formData.get("email"));
  if (!email) return { error: "Email is required." };
  try {
    const invite = await createDirectInvite(payload, {
      tripId,
      targetType: "email",
      targetValue: email,
      displayName: str(formData.get("name")),
    });
    revalidatePath(`/trips/${tripId}/people`);
    return { url: invite.url };
  } catch {
    return { error: "Could not create the invite." };
  }
}

export async function approveJoinAction(tripId: string, membershipId: string): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  await approveJoinRequest(payload, membershipId);
  revalidatePath(`/trips/${tripId}/people`);
}

export async function setRoleAction(
  tripId: string,
  membershipId: string,
  role: "organizer" | "co-organizer" | "participant",
): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  await setMembershipRole(payload, membershipId, role);
  revalidatePath(`/trips/${tripId}/people`);
}

export async function setOpenJoinAction(
  tripId: string,
  enabled: boolean,
  autoAccept: boolean,
): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  if (enabled) await enableOpenJoin(payload, tripId, { autoAccept });
  else await disableOpenJoin(payload, tripId);
  revalidatePath(`/trips/${tripId}/people`);
}

// --- Trip info & content (T-203) --------------------------------------------

export async function saveTripInfoAction(tripId: string, formData: FormData): Promise<void> {
  const { payload } = await requireOrganizer(tripId);

  // Structured array fields arrive as JSON from the RepeatableRows editor.
  const rows = (k: string): Record<string, string>[] => {
    try {
      const parsed = JSON.parse(String(formData.get(k) ?? "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const val = (r: Record<string, string>, k: string): string | null => {
    const v = (r[k] ?? "").trim();
    return v.length ? v : null;
  };

  const data: TripContentData = {
    destination: {
      name: str(formData.get("destName")) ?? null,
      location: str(formData.get("destLocation")) ?? null,
      mapUrl: str(formData.get("destMapUrl")) ?? null,
      description: str(formData.get("destDescription")) ?? null,
      basicInfo: rows("basicInfo")
        .map((r) => ({ label: val(r, "label") ?? "", value: val(r, "value") ?? "" }))
        .filter((r) => r.label),
      goodToKnow: rows("goodToKnow")
        .map((r) => ({ text: val(r, "text") ?? "" }))
        .filter((r) => r.text),
    },
    directions: rows("directions")
      .map((r) => ({
        origin: val(r, "origin") ?? "",
        duration: val(r, "duration"),
        distance: val(r, "distance"),
        notes: val(r, "notes"),
      }))
      .filter((r) => r.origin),
    parking: str(formData.get("parking")) ?? null,
    publicTransport: rows("publicTransport")
      .map((r) => ({
        line: val(r, "line") ?? "",
        from: val(r, "from"),
        to: val(r, "to"),
        departs: val(r, "departs"),
        arrives: val(r, "arrives"),
      }))
      .filter((r) => r.line),
    notes: str(formData.get("notes")) ?? null,
  };

  await upsertTripContent(payload, tripId, data);
  revalidatePath(`/trips/${tripId}/info`);
  redirect(`/trips/${tripId}/info`);
}

// --- Voting (T-302/303/305) -------------------------------------------------

const VOTE_VALUES = new Set<AvailabilityValue>(["yes", "ifneeded", "no"]);

/** Cast (or update) the caller's own vote on an option. Members only. */
export async function castVoteAction(
  tripId: string,
  kind: PollKind,
  optionId: string,
  value: AvailabilityValue,
): Promise<void> {
  if (!VOTE_VALUES.has(value)) throw new Error("Invalid vote value.");
  const { payload, membershipId } = await requireMember(tripId);
  await castVote(payload, { tripId, kind, membershipId, optionId, value });
  revalidatePath(`/trips/${tripId}/plan`);
}

/** A participant suggests a new candidate option (flagged as suggested). */
export async function suggestOptionAction(
  tripId: string,
  kind: PollKind,
  formData: FormData,
): Promise<void> {
  const { payload, membershipId } = await requireMember(tripId);
  await addOption(payload, {
    tripId,
    kind,
    dateStart: str(formData.get("dateStart")) ?? null,
    dateEnd: str(formData.get("dateEnd")) ?? null,
    label: str(formData.get("label")) ?? null,
    suggestedByMembershipId: membershipId,
  });
  revalidatePath(`/trips/${tripId}/plan`);
}

/** Organizer seeds an official candidate option. */
export async function addOptionAction(
  tripId: string,
  kind: PollKind,
  formData: FormData,
): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  await addOption(payload, {
    tripId,
    kind,
    dateStart: str(formData.get("dateStart")) ?? null,
    dateEnd: str(formData.get("dateEnd")) ?? null,
    label: str(formData.get("label")) ?? null,
  });
  revalidatePath(`/trips/${tripId}/plan`);
}

export async function removeOptionAction(tripId: string, optionId: string): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  await removeOption(payload, optionId);
  revalidatePath(`/trips/${tripId}/plan`);
}

export async function moderateOptionAction(
  tripId: string,
  optionId: string,
  action: "promote" | "hide" | "unhide",
): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  await moderateOption(payload, optionId, action);
  revalidatePath(`/trips/${tripId}/plan`);
}

export async function setPollMethodAction(
  tripId: string,
  kind: PollKind,
  method: PollMethod,
): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  await setPollMethod(payload, tripId, kind, method);
  revalidatePath(`/trips/${tripId}/plan`);
}

export async function publishPollAction(tripId: string, kind: PollKind): Promise<void> {
  const { payload } = await requireOrganizer(tripId);
  await publishPoll(payload, tripId, kind);
  revalidatePath(`/trips/${tripId}/plan`);
}

/** Close a poll and promote its winner onto the trip (dates or location). */
export async function closePollAction(
  tripId: string,
  kind: PollKind,
  winnerOptionId: string,
): Promise<void> {
  const { payload, identity } = await requireOrganizer(tripId);
  if (kind === "date") {
    await closeDatePoll(payload, tripId, { actor: identity.id, winnerOptionId });
  } else {
    await closeLocationPoll(payload, tripId, { actor: identity.id, winnerOptionId });
  }
  revalidatePath(`/trips/${tripId}/plan`);
  revalidatePath(`/trips/${tripId}`);
}

export async function reopenPollAction(tripId: string, kind: PollKind): Promise<void> {
  const { payload, identity } = await requireOrganizer(tripId);
  await reopenPoll(payload, tripId, kind, { actor: identity.id });
  revalidatePath(`/trips/${tripId}/plan`);
  revalidatePath(`/trips/${tripId}`);
}
