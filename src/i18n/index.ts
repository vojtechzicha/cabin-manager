/**
 * Server-safe i18n barrel (pure — no React, no Next). Client components import
 * the provider/hook from "@/i18n/react"; server request helpers live in
 * "@/i18n/server".
 */
export * from "./config";
export * from "./translator";
export * from "./format";
export * from "./resolve";
export * from "./system-messages";
export type { Messages } from "./messages/cs";
