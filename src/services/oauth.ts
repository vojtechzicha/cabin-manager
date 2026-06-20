/**
 * OAuth login for Google and Microsoft (build.md T-102, PRD §4).
 *
 * The handshake (authorize → exchange code → fetch userinfo) is standard
 * OAuth2/OIDC; the part that matters for correctness is `loginWithOAuth`, which
 * maps a verified provider profile onto **one** Identity: Google and Microsoft
 * logins for the same verified email resolve to the same Identity, and a new
 * email is provisioned on first login. That mapping is pure orchestration over
 * the Identity service and is what the integration tests exercise — no live
 * provider required.
 *
 * A provider is only "enabled" when both its client id and secret are configured
 * (see `lib/env`), so local dev and CI run without any OAuth setup.
 */
import type { Payload, PayloadRequest } from "payload";

import type { Locale } from "@/i18n";
import { getEnv } from "@/lib/env";
import type { Identity, Membership } from "@/payload-types";

import { AuthError } from "./auth-errors";
import {
  ensureIdentity,
  findIdentityByEmail,
  findIdentityByProvider,
  linkProvider,
  type OAuthProvider,
} from "./identity";
import { resolvePendingInvitesForEmail } from "./invitations";

interface ProviderEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

const ENDPOINTS: Record<OAuthProvider, ProviderEndpoints> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  microsoft: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scopes: ["openid", "email", "profile"],
  },
};

function credentials(provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const env = getEnv();
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID : env.MICROSOFT_CLIENT_ID;
  const clientSecret =
    provider === "google" ? env.GOOGLE_CLIENT_SECRET : env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Providers with configured credentials (drives which buttons the UI shows). */
export function enabledProviders(): OAuthProvider[] {
  return (Object.keys(ENDPOINTS) as OAuthProvider[]).filter((p) => credentials(p) !== null);
}

/** Build the provider's authorize URL to redirect the user to. */
export function buildAuthorizeUrl(
  provider: OAuthProvider,
  args: { redirectUri: string; state: string },
): string {
  const creds = credentials(provider);
  if (!creds) throw new AuthError("not_found", `OAuth provider "${provider}" is not configured`);
  const { authorizeUrl, scopes } = ENDPOINTS[provider];
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state: args.state,
    access_type: "offline",
    prompt: "select_account",
  });
  return `${authorizeUrl}?${params.toString()}`;
}

export interface OAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/** OIDC-ish claims we read for the display name, from either source. */
interface NameClaims {
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
}

/**
 * Decode an OIDC `id_token`'s payload (no signature check needed — it came
 * directly from the provider's token endpoint over TLS). Microsoft's userinfo
 * endpoint often omits `name`, but the id_token reliably carries it.
 */
function decodeIdTokenClaims(idToken?: string): Record<string, unknown> {
  const payload = idToken?.split(".")[1];
  if (!payload) return {};
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

/** Best display name from a claims source: `name`, else given + family. */
function fullName(claims: NameClaims): string | undefined {
  const name = asString(claims.name);
  if (name) return name;
  const parts = [asString(claims.given_name), asString(claims.family_name)].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

/** Exchange an authorization code for an access token, then fetch the profile. */
export async function fetchProfile(
  provider: OAuthProvider,
  args: { code: string; redirectUri: string },
): Promise<OAuthProfile> {
  const creds = credentials(provider);
  if (!creds) throw new AuthError("not_found", `OAuth provider "${provider}" is not configured`);
  const { tokenUrl, userInfoUrl } = ENDPOINTS[provider];

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code: args.code,
      grant_type: "authorization_code",
      redirect_uri: args.redirectUri,
    }),
  });
  if (!tokenRes.ok) throw new AuthError("invalid_token", `Token exchange failed (${tokenRes.status})`);
  const tokenJson = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!tokenJson.access_token) throw new AuthError("invalid_token", "No access token returned");
  // The id_token carries richer profile claims than Microsoft's userinfo does.
  const idClaims = decodeIdTokenClaims(tokenJson.id_token);

  const infoRes = await fetch(userInfoUrl, {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!infoRes.ok) throw new AuthError("invalid_token", `Userinfo failed (${infoRes.status})`);
  const info = (await infoRes.json()) as {
    sub?: string;
    oid?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    given_name?: string;
    family_name?: string;
  };

  const email = asString(info.email) ?? asString(idClaims.email);
  if (!email) throw new AuthError("invalid_token", "OAuth profile has no email");
  const verified = (v: unknown) => v === true || v === "true";

  return {
    provider,
    providerAccountId:
      asString(info.sub) ?? asString(info.oid) ?? asString(idClaims.sub) ?? asString(idClaims.oid) ?? email,
    email,
    // Verify from an explicit claim only — never blanket-trust a provider.
    // Google sends `email_verified`; Microsoft Entra signals a verified primary
    // email via `xms_edov` (email domain owner verified). An MS account without
    // it is treated as unverified, so it can't silently claim an existing
    // account (the login is rejected by `loginWithOAuth`).
    emailVerified:
      verified(info.email_verified) ||
      verified(idClaims.email_verified) ||
      verified((idClaims as { xms_edov?: unknown }).xms_edov),
    // Prefer userinfo's name, then the id_token's (Microsoft omits it from userinfo).
    name: fullName(info) ?? fullName(idClaims),
  };
}

export interface OAuthLoginResult {
  identity: Identity;
  created: boolean;
  activatedMemberships: Membership[];
}

/**
 * Resolve a provider profile to a single Identity (T-102 acceptance criteria).
 * Resolution order: **(1) the provider account id** — the stable identifier, so a
 * previously-linked account is recognised even if its email changed, and one
 * provider account can never attach to a second Identity; **(2) the verified
 * email**; **(3) create**. The email **must be verified** — we only link on a
 * verified address, so an unverified provider email can't take over an account.
 */
export async function loginWithOAuth(
  payload: Payload,
  profile: OAuthProfile,
  opts: { browserLocale?: Locale } = {},
  req?: PayloadRequest,
): Promise<OAuthLoginResult> {
  if (!profile.email) throw new AuthError("invalid_token", "OAuth profile has no email");
  if (!profile.emailVerified) {
    throw new AuthError("invalid_token", "OAuth email is not verified");
  }

  const linkedAccount = await findIdentityByProvider(
    payload,
    profile.provider,
    profile.providerAccountId,
    req,
  );
  let identity: Identity;
  let created = false;
  if (linkedAccount) {
    identity = linkedAccount;
  } else {
    const byEmail = await findIdentityByEmail(payload, profile.email, req);
    if (byEmail) {
      identity = byEmail;
    } else {
      const ensured = await ensureIdentity(
        payload,
        { email: profile.email, displayName: profile.name, preferredLanguage: opts.browserLocale },
        req,
      );
      identity = ensured.identity;
      created = ensured.created;
    }
  }

  let linked = await linkProvider(
    payload,
    identity,
    { provider: profile.provider, providerAccountId: profile.providerAccountId, email: profile.email },
    req,
  );

  // Backfill a missing display name on an existing Identity — e.g. one first
  // provisioned by magic link, or by a provider (Microsoft) that didn't return
  // a name on the original login. This self-heals accounts that show only an
  // email in the UI.
  if (!linked.displayName && profile.name) {
    linked = await payload.update({
      collection: "identities",
      id: linked.id,
      overrideAccess: true,
      req,
      data: { displayName: profile.name },
    });
  }

  const activatedMemberships = await resolvePendingInvitesForEmail(payload, linked, req);
  return { identity: linked, created, activatedMemberships };
}
