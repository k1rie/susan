import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next*/**",
    "node_modules.nosync/**",
    ".local*/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // WASM y JS generados de MediaPipe (se copian de node_modules en postinstall): no es código nuestro.
    "public/mediapipe/**",
  ]),
]);

export default eslintConfig;
