import nextCore from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next@16 ships native flat configs (arrays) — spread directly;
// FlatCompat is for legacy eslintrc-style configs and breaks on these.
const nextFlat = [
  ...(Array.isArray(nextCore) ? nextCore : [nextCore]),
  ...(Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]),
  ...(Array.isArray(nextTypescript) ? nextTypescript : [nextTypescript]),
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextFlat,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
