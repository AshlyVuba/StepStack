import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    env: { NODE_ENV: "test" },
    exclude: ["dist/**", "node_modules/**"]
  }
});
