import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliBin = path.join(repoRoot, "apps", "cli", "dist", "index.js");

await access(cliBin);

const checks = [
  ["--help"],
  ["demo", "--help"]
];

for (const args of checks) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [cliBin, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NO_COLOR: "1"
    }
  });
  const output = `${stdout}\n${stderr}`;
  if (!output.includes("Doorframe")) {
    throw new Error(`Expected Doorframe help output for \`doorframe ${args.join(" ")}\`.`);
  }
}

console.log("CLI binary smoke tests passed.");
