import { chmod, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = path.join(repoRoot, "apps", "cli");
const outDir = path.join(cliDir, "dist");
const outfile = path.join(outDir, "index.js");

await rm(outDir, { force: true, recursive: true });
await mkdir(outDir, { recursive: true });

await build({
  bundle: true,
  entryPoints: [path.join(cliDir, "src", "index.ts")],
  external: ["better-sqlite3"],
  format: "esm",
  legalComments: "none",
  logLevel: "silent",
  outfile,
  platform: "node",
  target: "node20"
});

await chmod(outfile, 0o755);
