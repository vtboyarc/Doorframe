import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createDemoProjectDb } from "../../../mcp-server/src/__tests__/fixtures";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliBin = path.join(repoRoot, "apps", "cli", "dist", "index.js");
const cliPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "apps", "cli", "package.json"), "utf8")) as {
  version: string;
};

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
    expect(stdout).toContain("doorframe serve");
    expect(stdout).toContain("doorframe mcp --project");
    expect(stdout).toContain("doorframe mcp doctor --project");
  });

  it("prints the packaged CLI version", async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliBin, "--version"], {
      cwd: repoRoot
    });

    expect(stdout.trim()).toBe(cliPackageJson.version);
  });

  it("prints demo help", async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliBin, "demo", "--help"], {
      cwd: repoRoot
    });

    expect(stdout).toContain("Doorframe demo");
    expect(stdout).toContain("doorframe demo");
  });

  it("prints serve help", async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliBin, "serve", "--help"], {
      cwd: repoRoot
    });

    expect(stdout).toContain("Doorframe serve");
    expect(stdout).toContain("doorframe serve");
    expect(stdout).toContain("-p <port>");
  });

  it.each(["packaged", "source"])("forwards port options to the %s web server", async (layout) => {
    // A stub observes the real launcher boundary without opening a network port.
    const fixture = fs.mkdtempSync(path.join(repoRoot, ".serve-test-"));
    try {
      const bin = path.join(fixture, "apps/cli/dist/index.js");
      const web = path.join(fixture, layout === "packaged"
        ? "apps/cli/web/standalone/apps/web/server.js"
        : "apps/web/.next/standalone/apps/web/server.js");
      fs.mkdirSync(path.dirname(bin), { recursive: true });
      fs.mkdirSync(path.dirname(web), { recursive: true });
      fs.copyFileSync(cliBin, bin);
      fs.writeFileSync(web, 'console.log("LAUNCH_CONFIG " + JSON.stringify({ port: process.env.PORT, host: process.env.HOSTNAME, dataDir: process.env.DOORFRAME_DATA_DIR }));');
      const cases = [
        { command: "serve", args: ["--port", "3317"], expected: "3317" },
        { command: "serve", args: ["-p", "3318"], expected: "3318" },
        { command: "server", args: ["-p", "3319"], expected: "3319" },
        { command: "serve", args: [], expected: "3320" }
      ];
      for (const item of cases) {
        const { stdout } = await execFileAsync(process.execPath, [bin, item.command, ...item.args, "--host", "127.0.0.1", "--data-dir", "./data"], {
          cwd: fixture,
          env: { ...process.env, PORT: "3320" }
        });
        const config = JSON.parse(stdout.split("\n").find((line) => line.startsWith("LAUNCH_CONFIG "))!.slice("LAUNCH_CONFIG ".length));
        expect(config).toEqual({ port: item.expected, host: "127.0.0.1", dataDir: path.join(fixture, "data") });
      }
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("prints MCP help", async () => {
    const { stderr } = await execFileAsync(process.execPath, [cliBin, "mcp", "--help"], {
      cwd: repoRoot
    });

    expect(stderr).toContain("Doorframe MCP server");
    expect(stderr).toContain("doorframe mcp --project");
    expect(stderr).toContain("doorframe-mcp-audit.jsonl");
    expect(stderr).not.toContain("doorframe mcp-audit.jsonl");
  });

  it("runs MCP doctor against a demo project database", async () => {
    const dbPath = createDemoProjectDb();
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        cliBin,
        "mcp",
        "doctor",
        "--project",
        dbPath,
        "--project-id",
        "project_1",
        "--mode",
        "summary",
        "--max-results",
        "2"
      ],
      {
        cwd: repoRoot,
        timeout: 15_000
      }
    );

    expect(stdout).toContain("Doorframe MCP doctor");
    expect(stdout).toContain("PASS server initialized");
    expect(stdout).toContain("PASS get_project_summary");
    expect(stdout).toContain("PASS get_traceability_gaps");
  });
});
