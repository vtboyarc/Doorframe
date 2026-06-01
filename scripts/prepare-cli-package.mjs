import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = path.join(repoRoot, "apps", "cli");

const docs = [
  "install.md",
  "cli.md",
  "mcp-server.md",
  "docker.md",
  "security-model.md",
  "no-telemetry.md",
  "data-handling.md"
];

await cp(path.join(repoRoot, "LICENSE"), path.join(cliDir, "LICENSE"));

await rm(path.join(cliDir, "docs"), { force: true, recursive: true });
await mkdir(path.join(cliDir, "docs"), { recursive: true });
for (const doc of docs) {
  await cp(path.join(repoRoot, "docs", doc), path.join(cliDir, "docs", doc));
}

await rm(path.join(cliDir, "examples"), { force: true, recursive: true });
await mkdir(path.join(cliDir, "examples"), { recursive: true });
await cp(
  path.join(repoRoot, "examples", "falcon-telemetry-gateway"),
  path.join(cliDir, "examples", "falcon-telemetry-gateway"),
  { recursive: true }
);

const standaloneDir = path.join(repoRoot, "apps", "web", ".next", "standalone");
const packagedWebDir = path.join(cliDir, "web", "standalone");
await rm(path.join(cliDir, "web"), { force: true, recursive: true });
await mkdir(path.join(packagedWebDir), { recursive: true });
await cp(standaloneDir, packagedWebDir, { recursive: true });
await cp(
  path.join(repoRoot, "apps", "web", ".next", "static"),
  path.join(packagedWebDir, "apps", "web", ".next", "static"),
  { recursive: true }
);
await rm(path.join(packagedWebDir, "node_modules"), { force: true, recursive: true });
await rm(path.join(packagedWebDir, "apps", "web", ".doorframe"), { force: true, recursive: true });
