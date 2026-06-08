import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/cli/src/**/*.test.ts", "apps/mcp-server/src/**/*.test.ts", "apps/web/src/**/*.test.ts"]
  }
});
