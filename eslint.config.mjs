import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

/**
 * Architecture boundaries (build.md §0.2, T-002).
 *
 * Layers and their allowed dependencies:
 *   domain      → nothing (pure money/state math)
 *   payments    → nothing (pure SPAYD/IBAN)
 *   lib         → nothing (universal leaf utilities)
 *   i18n        → lib
 *   access      → collections, i18n, lib
 *   collections → access, i18n, lib
 *   services    → domain, payments, collections, access, i18n, lib
 *   components  → i18n, lib
 *   app         → services, components, collections, config, access, i18n, lib
 *   config      → wires everything (payload.config.ts)
 *
 * Additionally, `domain` and `payments` may not import Payload, Next, Mongo, or
 * React — enforced by `boundaries/external`. A violating import fails CI.
 */
const layerElements = [
  { type: "domain", pattern: "src/domain/**", mode: "file" },
  { type: "payments", pattern: "src/payments/**", mode: "file" },
  { type: "i18n", pattern: "src/i18n/**", mode: "file" },
  { type: "collections", pattern: "src/collections/**", mode: "file" },
  { type: "access", pattern: "src/access/**", mode: "file" },
  { type: "services", pattern: "src/services/**", mode: "file" },
  { type: "components", pattern: "src/components/**", mode: "file" },
  { type: "app", pattern: "src/app/**", mode: "file" },
  { type: "lib", pattern: "src/lib/**", mode: "file" },
  { type: "config", pattern: "src/payload.config.ts", mode: "file" },
];

const allowedDeps = [
  { from: ["domain"], allow: ["domain"] },
  { from: ["payments"], allow: ["payments"] },
  { from: ["lib"], allow: ["lib"] },
  { from: ["i18n"], allow: ["i18n", "lib"] },
  { from: ["access"], allow: ["access", "collections", "i18n", "lib"] },
  { from: ["collections"], allow: ["collections", "access", "i18n", "lib"] },
  {
    from: ["services"],
    allow: ["services", "domain", "payments", "collections", "access", "i18n", "lib"],
  },
  { from: ["components"], allow: ["components", "i18n", "lib"] },
  {
    from: ["app"],
    allow: ["app", "services", "components", "collections", "config", "access", "i18n", "lib"],
  },
  {
    from: ["config"],
    allow: ["config", "collections", "domain", "payments", "services", "access", "i18n", "lib"],
  },
];

const forbiddenFrameworks = [
  "payload",
  "payload/*",
  "@payloadcms/*",
  "next",
  "next/*",
  "react",
  "react/*",
  "react-dom",
  "react-dom/*",
  "mongoose",
  "mongodb",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx,js,jsx,mts}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": layerElements,
      "boundaries/include": ["src/**/*"],
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      "boundaries/element-types": [2, { default: "disallow", rules: allowedDeps }],
      "boundaries/external": [
        2,
        {
          default: "allow",
          rules: [{ from: ["domain", "payments"], disallow: forbiddenFrameworks }],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "archive/**",
    "src/payload-types.ts",
  ]),
]);

export default eslintConfig;
