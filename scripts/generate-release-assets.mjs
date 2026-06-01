import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(repoRoot, "release-artifacts");
const cliBin = path.join(repoRoot, "apps", "cli", "dist", "index.js");
const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const version = String(rootPackage.version);
const tagName = process.env.GITHUB_REF_NAME || `v${version}`;
const owner = (process.env.GITHUB_REPOSITORY_OWNER || "vtboyarc").toLowerCase();
const image = `ghcr.io/${owner}/doorframe:${version}`;

await rm(artifactsDir, { force: true, recursive: true });
await mkdir(artifactsDir, { recursive: true });

const reportPath = path.join(artifactsDir, "doorframe-falcon-traceability-report.html");
const diffPath = path.join(artifactsDir, "doorframe-falcon-baseline-diff.html");

await execFileAsync(process.execPath, [
  cliBin,
  "demo",
  "--out",
  reportPath,
  "--diff-out",
  diffPath
], { cwd: repoRoot });

const checksumTargets = [reportPath, diffPath];
const checksumLines = [];
for (const filePath of checksumTargets) {
  const data = await readFile(filePath);
  const checksum = createHash("sha256").update(data).digest("hex");
  checksumLines.push(`${checksum}  ${path.basename(filePath)}`);
}
await writeFile(path.join(artifactsDir, "checksums.txt"), `${checksumLines.join("\n")}\n`, "utf8");

const releaseNotes = `# Doorframe ${tagName}

Initial public preview release for local-first requirements traceability review.

## Install

\`\`\`bash
npx @doorframe/cli@${version} demo
npm install -g @doorframe/cli@${version}
doorframe --help
\`\`\`

## CLI

\`\`\`bash
npx @doorframe/cli@${version} analyze \\
  --requirements requirements.csv \\
  --jira jira.csv \\
  --junit test-results.xml \\
  --out doorframe-report.html
\`\`\`

## MCP

\`\`\`bash
npx @doorframe/cli@${version} mcp --project ./doorframe.sqlite
\`\`\`

Doorframe MCP is optional and read-only. It does not include an AI model or call AI providers.

## Docker

\`\`\`bash
docker run -p 3000:3000 -v doorframe-data:/data ${image}
\`\`\`

Stable releases may also publish \`ghcr.io/${owner}/doorframe:latest\`.

## Artifacts

- \`doorframe-falcon-traceability-report.html\`: generated offline HTML report from the fictional Falcon Telemetry Gateway demo.
- \`doorframe-falcon-baseline-diff.html\`: generated offline baseline diff report.
- \`checksums.txt\`: SHA-256 checksums for generated release artifacts.

## Known Limitations

- Doorframe is a local review aid, not a requirements management system.
- The MCP server is read-only and requires a local Doorframe SQLite project database.
- Connector commands only call external systems when explicitly invoked with credentials.

## Security And Privacy

Doorframe runs locally by default and has no telemetry in the MVP. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.

Docs: https://github.com/vtboyarc/Doorframe/tree/main/docs
`;

await writeFile(path.join(artifactsDir, "release-notes.md"), releaseNotes, "utf8");
console.log(`Release assets written to ${artifactsDir}`);
