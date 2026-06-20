/**
 * Issue a Payload auth cookie for an Identity (build.md T-102/T-103).
 *
 * Magic-link and OAuth logins verify a one-time credential, then need to put the
 * caller into an authenticated Payload session. Rather than reinvent auth, we
 * mint the exact JWT Payload's built-in strategy expects (`getFieldsToSign` +
 * `jwtSign`) and hand back the cookie name/value to set on the HTTP response.
 * Sessions are disabled on the `identities` collection, so this stateless token
 * authenticates subsequent requests on its own.
 */
import { getFieldsToSign, jwtSign, type Payload } from "payload";

import type { Identity } from "@/payload-types";

const IDENTITIES = "identities";
/** Payload's default token lifetime when the collection doesn't override it. */
const DEFAULT_TOKEN_EXPIRATION_SECONDS = 7200;

export interface IssuedAuthToken {
  /** Cookie name Payload's JWT strategy reads, e.g. `payload-token`. */
  cookieName: string;
  /** Signed JWT value. */
  token: string;
  /** Absolute expiry, for the cookie's `expires` attribute. */
  expiresAt: Date;
}

/**
 * Build the auth cookie for `identity`. The caller sets it on the response
 * (`Set-Cookie`) — see the magic-link / OAuth routes. Throws if the identities
 * collection is somehow unavailable (a config invariant).
 */
export async function issueAuthToken(
  payload: Payload,
  identity: Identity,
): Promise<IssuedAuthToken> {
  const collection = payload.collections[IDENTITIES]?.config;
  if (!collection) {
    throw new Error(`Auth collection "${IDENTITIES}" is not registered`);
  }

  const tokenExpiration =
    typeof collection.auth === "object" && collection.auth?.tokenExpiration
      ? collection.auth.tokenExpiration
      : DEFAULT_TOKEN_EXPIRATION_SECONDS;

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collection,
    email: identity.email,
    user: { ...identity, collection: IDENTITIES } as Parameters<typeof getFieldsToSign>[0]["user"],
  });

  const { token, exp } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration,
  });

  const cookiePrefix = payload.config.cookiePrefix ?? "payload";
  return {
    cookieName: `${cookiePrefix}-token`,
    token,
    expiresAt: new Date(exp * 1000),
  };
}
