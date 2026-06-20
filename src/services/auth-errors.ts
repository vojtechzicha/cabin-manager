/**
 * Typed authentication errors so routes can map a failure to the right HTTP
 * status and a localized message, rather than parsing strings (T-103/T-104).
 */
export type AuthErrorCode =
  | "invalid_token"
  | "expired_token"
  | "used_token"
  | "open_join_disabled"
  | "already_member"
  | "not_found";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuthError";
  }
}

export function isAuthError(err: unknown): err is AuthError {
  return err instanceof AuthError;
}
