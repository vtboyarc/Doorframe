import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliBin = path.join(repoRoot, "apps", "cli", "dist", "index.js");
const packagedServer = path.join(repoRoot, "apps", "cli", "web", "standalone", "apps", "web", "server.js");

await access(cliBin);

const checks = [
  ["--help"],
  ["demo", "--help"],
  ["serve", "--help"],
  ["server", "--help"],
  ["mcp", "--help"]
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

async function findOpenPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  if (!address || typeof address === "string") {
    throw new Error("Unable to reserve a local port for the packaged web smoke test.");
  }
  return address.port;
}

async function waitForJson(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function smokePackagedWebApp() {
  await access(packagedServer);
  const port = await findOpenPort();
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "doorframe-web-smoke-"));
  const child = spawn(process.execPath, [
    cliBin,
    "serve",
    "--port",
    String(port),
    "--data-dir",
    dataDir
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NO_COLOR: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const health = await waitForJson(`${baseUrl}/api/health`);
    if (health.ok !== true) {
      throw new Error(`Expected health ok true, received ${JSON.stringify(health)}.`);
    }

    const created = await waitForJson(`${baseUrl}/api/projects`, {
      body: JSON.stringify({ name: "Smoke Project" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    if (!created.project?.id) {
      throw new Error(`Expected a created project, received ${JSON.stringify(created)}.`);
    }
  } catch (error) {
    throw new Error(`Packaged web smoke test failed: ${error instanceof Error ? error.message : String(error)}\n${logs.join("")}`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
    await exitPromise;
    await rm(dataDir, { force: true, recursive: true });
  }
}

try {
  await smokePackagedWebApp();
} catch (error) {
  if (error instanceof Error && error.message.includes("ENOENT")) {
    throw new Error("Packaged web app is missing. Run the package prepack flow before test:bin.");
  }
  throw error;
}

console.log("CLI binary smoke tests passed.");
