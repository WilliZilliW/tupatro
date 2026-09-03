import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules", ".claude"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
      /* The seeded generator is the only source of randomness in game logic;
         makeSeed in rng.ts is the single documented exception. */
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "use the run's Rng, not Math.random" },
      ],
    },
  },
  {
    /* The RNG module owns the one permitted Math.random call. */
    files: ["src/game/rng.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
);
