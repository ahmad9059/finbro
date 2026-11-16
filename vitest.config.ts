import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Server modules validate env on import; tests do not need a real database.
    env: { SKIP_ENV_VALIDATION: "true" },
  },
});
