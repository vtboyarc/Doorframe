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
  ["mcp", "--help"],
  ["mcp", "doctor", "--help"]
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

const { stdout: versionStdout } = await execFileAsync(process.execPath, [cliBin, "--version"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NO_COLOR: "1"
  }
});
if (!/^\d+\.\d+\.\d+/.test(versionStdout.trim())) {
  throw new Error(`Expected semantic version output from \`doorframe --version\`, received ${JSON.stringify(versionStdout)}.`);
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

async function smokeMcpStdioServer(dbPath, projectId) {
  const child = spawn(process.execPath, [
    cliBin,
    "mcp",
    "--project",
    dbPath,
    "--project-id",
    projectId,
    "--mode",
    "summary",
    "--max-results",
    "5"
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NO_COLOR: "1"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });

  const stderrLogs = [];
  child.stderr.on("data", (chunk) => stderrLogs.push(chunk.toString()));
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));

  const responses = new Map();
  let pendingStdout = "";
  let notifyResponse = () => {};
  child.stdout.on("data", (chunk) => {
    pendingStdout += chunk.toString();
    let newlineIndex = pendingStdout.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = pendingStdout.slice(0, newlineIndex).trim();
      pendingStdout = pendingStdout.slice(newlineIndex + 1);
      if (line) {
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined) {
            responses.set(message.id, message);
            notifyResponse();
          }
        } catch {
          // Ignore non-JSON stdout noise; protocol violations surface as a timeout below.
        }
      }
      newlineIndex = pendingStdout.indexOf("\n");
    }
  });

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  async function waitForResponse(id) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (responses.has(id)) {
        return responses.get(id);
      }
      if (child.exitCode !== null) {
        throw new Error(`MCP server exited early with code ${child.exitCode}.`);
      }
      await new Promise((resolve) => {
        notifyResponse = resolve;
        setTimeout(resolve, 250);
      });
    }
    throw new Error(`Timed out waiting for MCP response id ${id}.`);
  }

  try {
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "doorframe-smoke", version: "0.0.0" }
      }
    });
    const initialized = await waitForResponse(1);
    if (!initialized.result?.serverInfo?.name) {
      throw new Error(`Expected an MCP initialize result, received ${JSON.stringify(initialized)}.`);
    }

    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const toolsResponse = await waitForResponse(2);
    const toolNames = (toolsResponse.result?.tools ?? []).map((tool) => tool.name);
    if (!toolNames.includes("get_project_summary")) {
      throw new Error(`Expected get_project_summary in MCP tools, received: ${toolNames.join(", ") || "none"}.`);
    }
  } catch (error) {
    throw new Error(`MCP stdio smoke test failed: ${error instanceof Error ? error.message : String(error)}\n${stderrLogs.join("")}`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
    await exitPromise;
  }
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

    const { stdout: doctorStdout } = await execFileAsync(
      process.execPath,
      [
        cliBin,
        "mcp",
        "doctor",
        "--project",
        path.join(dataDir, "doorframe.sqlite"),
        "--project-id",
        created.project.id,
        "--mode",
        "summary",
        "--max-results",
        "5"
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          NO_COLOR: "1"
        },
        timeout: 15000
      }
    );
    if (!doctorStdout.includes("PASS get_traceability_gaps")) {
      throw new Error(`Expected MCP doctor success output, received ${doctorStdout}.`);
    }

    await smokeMcpStdioServer(path.join(dataDir, "doorframe.sqlite"), created.project.id);
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
