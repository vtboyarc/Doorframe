import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = path.join(repoRoot, "apps", "cli");

async function listJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }
  return files;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFilesByName(dir, filename) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findFilesByName(entryPath, filename));
    } else if (entry.isFile() && entry.name === filename) {
      files.push(entryPath);
    }
  }
  return files;
}

async function findWebAppDir(packagedWebDir) {
  const expectedServer = path.join(packagedWebDir, "apps", "web", "server.js");
  if (await fileExists(expectedServer)) {
    return path.dirname(expectedServer);
  }

  const serverFiles = await findFilesByName(packagedWebDir, "server.js");
  const webServerFiles = serverFiles.filter((file) => {
    const webDir = path.dirname(file);
    return path.basename(webDir) === "web" && path.basename(path.dirname(webDir)) === "apps";
  });

  if (webServerFiles.length === 1) {
    return path.dirname(webServerFiles[0]);
  }

  throw new Error("Unable to locate the built Doorframe web app server in the standalone output.");
}

async function removeDirsNamed(dir, name) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === name) {
      await rm(entryPath, { force: true, recursive: true });
    } else {
      await removeDirsNamed(entryPath, name);
    }
  }
}

async function findBetterSqliteAliases(serverDir) {
  const aliases = new Set();
  const files = await listJsFiles(serverDir);
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const match of contents.matchAll(/better-sqlite3-[a-f0-9]+/g)) {
      aliases.add(match[0]);
    }
  }
  return [...aliases].sort();
}

async function writeBetterSqliteAliasShims(packagedWebDir, appDir) {
  const aliases = await findBetterSqliteAliases(path.join(appDir, ".next", "server"));
  for (const alias of aliases) {
    const aliasDir = path.join(packagedWebDir, "node_modules", alias);
    await mkdir(aliasDir, { recursive: true });
    await writeFile(
      path.join(aliasDir, "package.json"),
      JSON.stringify({ name: alias, private: true, main: "index.js" }, null, 2),
      "utf8"
    );
    await writeFile(
      path.join(aliasDir, "index.js"),
      `"use strict";\n\nmodule.exports = require("better-sqlite3");\n`,
      "utf8"
    );
  }
}

const docs = [
  "install.md",
  "cli.md",
  "mcp-server.md",
  "docker.md",
  "security-model.md",
  "no-telemetry.md",
  "data-handling.md",
  "mcp-troubleshooting.md"
];

await cp(path.join(repoRoot, "LICENSE"), path.join(cliDir, "LICENSE"));

await rm(path.join(cliDir, "docs"), { force: true, recursive: true });
await mkdir(path.join(cliDir, "docs"), { recursive: true });
for (const doc of docs) {
  await cp(path.join(repoRoot, "docs", doc), path.join(cliDir, "docs", doc));
}
await cp(path.join(repoRoot, "docs", "mcp-clients"), path.join(cliDir, "docs", "mcp-clients"), {
  recursive: true
});

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
await cp(standaloneDir, packagedWebDir, { recursive: true });
const packagedAppDir = await findWebAppDir(packagedWebDir);
await cp(
  path.join(repoRoot, "apps", "web", ".next", "static"),
  path.join(packagedAppDir, ".next", "static"),
  { recursive: true }
);
await removeDirsNamed(packagedWebDir, "node_modules");
await removeDirsNamed(packagedWebDir, ".doorframe");
await writeBetterSqliteAliasShims(packagedWebDir, packagedAppDir);
