#!/usr/bin/env node
// Launcher for the installed `doorframe-mcp` binary.
//
// Every Doorframe workspace package ships TypeScript source as its entry
// point (see each package.json `main`), so the MCP server is executed through
// tsx at runtime. Rather than rely on a `#!/usr/bin/env tsx` shebang -- which
// requires tsx to be on PATH and therefore breaks for installed/global
// binaries -- this launcher resolves tsx from this package's own dependencies
// and runs the server through it. This works for global, local, and npx
// installs alike.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tsxPackageJsonPath = require.resolve("tsx/package.json");
const tsxPackageJson = require(tsxPackageJsonPath);
const tsxBinRelative =
  typeof tsxPackageJson.bin === "string" ? tsxPackageJson.bin : tsxPackageJson.bin.tsx;
const tsxBin = path.join(path.dirname(tsxPackageJsonPath), tsxBinRelative);

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));

// stdio is inherited so the MCP stdio transport sees the real stdin/stdout.
const child = spawn(process.execPath, [tsxBin, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

// Forward termination signals to the child so that when an MCP client stops
// the spawned command (e.g. SIGTERM/SIGINT to this wrapper's PID) the tsx
// server shuts down too, rather than being orphaned while holding the
// inherited stdio pipes.
const forwardedSignals = ["SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT"];
for (const signal of forwardedSignals) {
  process.on(signal, () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
