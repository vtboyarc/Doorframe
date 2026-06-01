import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliBin = path.join(repoRoot, "apps", "cli", "dist", "index.js");

describe("doorframe binary", () => {
  beforeAll(async () => {
    await execFileAsync(process.execPath, [path.join(repoRoot, "scripts", "build-cli.mjs")], {
      cwd: repoRoot
    });
  }, 30_000);

  it("starts and prints global help", async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliBin, "--help"], {
      cwd: repoRoot
    });

    expect(stdout).toContain("Doorframe CLI");
    expect(stdout).toContain("doorframe demo");
    expect(stdout).toContain("doorframe mcp --project");
  });

  it("prints demo help", async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliBin, "demo", "--help"], {
      cwd: repoRoot
    });

    expect(stdout).toContain("Doorframe demo");
    expect(stdout).toContain("doorframe demo");
  });
});
