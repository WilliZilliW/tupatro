/* Flat config. Two environments: src/ runs in the browser inside the built
   bundle, build.js and test/ run in Node. */
export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Set: "readonly",
        Math: "readonly",
        JSON: "readonly",
        Object: "readonly",
        Array: "readonly",
        String: "readonly",
        Number: "readonly",
        Boolean: "readonly",
        KeyboardEvent: "readonly",
        PointerEvent: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "after-used" }],
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
      "no-implicit-globals": "error",
      /* The seeded generator is the only source of randomness in game logic;
         makeSeed in rng.js is the single documented exception. */
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "use rnd() from rng.js" },
      ],
    },
  },
  {
    /* rng.js draws a fresh seed, which is the one place Math.random belongs. */
    files: ["src/rng.js"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["build.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        Set: "readonly",
        Math: "readonly",
        JSON: "readonly",
        Object: "readonly",
        Array: "readonly",
        String: "readonly",
        Number: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "after-used" }],
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
];
