/**
 * Access layer barrel. Reusable predicates (T-106) and the composed
 * per-collection policies that apply them. Collections import from here; the
 * client is never trusted with authorization.
 */
export * from "./predicates";
export * from "./collections";
