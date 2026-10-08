import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["extension/vendor/**"] },
  js.configs.recommended,
  {
    files: ["extension/**/*.js"],
    languageOptions: { globals: { ...globals.browser, chrome: "readonly", browser: "readonly" } },
  },
  {
    files: ["extension/audio/capture-worklet.js"],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
        sampleRate: "readonly",
      },
    },
  },
  {
    files: ["extension/audio/mp3-worker.js"],
    languageOptions: { globals: { ...globals.worker, lamejs: "readonly" } },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
  { rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
];
