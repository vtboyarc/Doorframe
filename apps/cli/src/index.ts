#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  generateBaselineDiffHtmlReport,
  generateHtmlTraceabilityReport,
  generateJsonReport,
  generateMarkdownTraceabilityReport,
  generateTraceabilityMatrixCsv
} from "@doorframe/reporting";
import {
  parseJiraCsv,
  parseJUnitXml,
  parseReqif,
  parseRequirementsCsv,
  type ParsedTestCase,
  type ParsedWorkItem
} from "@doorframe/parsers";
import {
  fetchGithubJunit,
  fetchGitlabJunit,
  fetchJenkinsTestReport,
  fetchJiraIssues,
  githubConfigFromEnv,
  gitlabConfigFromEnv,
  jenkinsConfigFromEnv,
  jiraConfigFromEnv
} from "@doorframe/integrations";
import {
  buildProjectDataFromImportedRecords,
  defaultJiraCsvMapping,
  defaultRequirementsCsvMapping,
  summarizeProjectData
} from "@doorframe/storage";
import { compareRequirementBaselines } from "@doorframe/analyzers";
import {
  DEFAULT_RULESET,
  diffBaselines,
  normalizeRuleset,
  type ImportBatch,
  type ProjectSnapshot,
  type RequirementInput,
  type Ruleset
} from "@doorframe/core";
import { loadProjectDb, usageText as mcpUsageText } from "../../mcp-server/src/project-loader";
import { runStdioServer } from "../../mcp-server/src/server";

type ReportFormat = "html" | "md" | "json" | "csv";

interface CliOptions {
  [key: string]: string | undefined;
}

function usage(): string {
  return `Doorframe CLI

Usage:
  doorframe demo [--out report.html] [--diff-out diff.html] [--skip-diff]
  doorframe serve [--port 3000] [--host 127.0.0.1] [--data-dir ./.doorframe]
  doorframe server [--port 3000] [--host 127.0.0.1] [--data-dir ./.doorframe]
  doorframe analyze --requirements req.csv [--jira jira.csv] [--junit tests.xml] [--reqif spec.reqif] [--format html|md|json|csv] [--ruleset rules.json] [--out report.ext]
  doorframe report --requirements req.csv [--jira jira.csv] [--junit tests.xml] [--format html|md|json|csv] [--out report.ext]
  doorframe diff --baseline-a req-a.csv --baseline-b req-b.csv [--jira jira.csv] [--junit tests.xml] [--out diff.html]
  doorframe diff --base baseline-a.json --against baseline-b.json
  doorframe mcp --project ./doorframe.sqlite
  doorframe import-jira --requirements req.csv [--jql "project=FG"] [--format ...] [--out ...]
  doorframe import-github --requirements req.csv [--junit-xml file.xml] [--owner o --repo r] [...]
  doorframe import-gitlab --requirements req.csv [--project-id N --job-id N] [...]
  doorframe import-jenkins --requirements req.csv [--job name --build N] [...]

Connector credentials are read from DOORFRAME_* environment variables (local-first).
See docs/cli.md for details.
`;
}

function serveUsage(): string {
  return `Doorframe serve

Usage:
  doorframe serve [--port 3000] [--host 127.0.0.1] [--data-dir ./.doorframe]
  doorframe server [--port 3000] [--host 127.0.0.1] [--data-dir ./.doorframe]

Starts the local Doorframe web app. Open the printed localhost URL in a browser.
`;
}

function demoUsage(): string {
  return `Doorframe demo

Usage:
  doorframe demo [--out report.html] [--diff-out diff.html] [--skip-diff]

Generates offline HTML reports from the fictional Falcon Telemetry Gateway sample data.
`;
}

function analyzeUsage(command = "analyze"): string {
  return `Doorframe ${command}

Usage:
  doorframe ${command} --requirements req.csv [--jira jira.csv] [--junit tests.xml] [--reqif spec.reqif] [--format html|md|json|csv] [--ruleset rules.json] [--out report.ext]

Builds a local traceability report from requirements, Jira CSV, JUnit XML, and ReqIF exports.
`;
}

function diffUsage(): string {
  return `Doorframe diff

Usage:
  doorframe diff --baseline-a req-a.csv --baseline-b req-b.csv [--jira jira.csv] [--junit tests.xml] [--out diff.html]
  doorframe diff --base baseline-a.json --against baseline-b.json

Compares requirement baselines or two JSON snapshots from analyze --format json.
`;
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = "true";
      }
    }
  }
  return options;
}

function isHelp(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function requireOption(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required option --${name}.`);
  }
  return value;
}

async function readUtf8(filePath: string): Promise<string> {
  return fs.readFile(path.resolve(filePath), "utf8");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findWebServer(rootDir: string): Promise<string | null> {
  let entries;
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isFile() && entry.name === "server.js") {
      const webDir = path.dirname(entryPath);
      if (path.basename(webDir) === "web" && path.basename(path.dirname(webDir)) === "apps") {
        return entryPath;
      }
    }
    if (entry.isDirectory()) {
      const found = await findWebServer(entryPath);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

async function resolveDemoFile(filename: string): Promise<string> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, "../examples/falcon-telemetry-gateway", filename),
    path.resolve(currentDir, "../../../examples/falcon-telemetry-gateway", filename)
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate bundled demo file ${filename}.`);
}

async function resolveWebServer(): Promise<string> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const packagedWebRoot = path.resolve(currentDir, "../web/standalone");
  const sourceWebRoot = path.resolve(currentDir, "../../../apps/web/.next/standalone");
  const candidates = [
    path.resolve(packagedWebRoot, "apps/web/server.js"),
    path.resolve(sourceWebRoot, "apps/web/server.js")
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  const generatedCandidate = (await findWebServer(packagedWebRoot)) ?? (await findWebServer(sourceWebRoot));
  if (generatedCandidate) {
    return generatedCandidate;
  }

  throw new Error("Unable to locate the packaged Doorframe web app. Run `npm run build -w apps/web` before serving from source.");
}

async function loadRuleset(rulesetPath: string | undefined): Promise<Ruleset> {
  if (!rulesetPath) {
    return DEFAULT_RULESET;
  }
  const raw = await readUtf8(rulesetPath);
  return normalizeRuleset(JSON.parse(raw) as Partial<Ruleset>);
}

function importBatch(sourceType: string, filename: string, recordCount: number, errors: string[]): ImportBatch {
  return {
    id: `import_${sourceType}`,
    projectId: "project_cli",
    sourceType,
    filename,
    importedAt: new Date().toISOString(),
    recordCount,
    errors
  };
}

function renderReport(data: ReturnType<typeof buildProjectDataFromImportedRecords>, format: ReportFormat): string {
  switch (format) {
    case "md":
      return generateMarkdownTraceabilityReport(data);
    case "json":
      return generateJsonReport(data);
    case "csv":
      return generateTraceabilityMatrixCsv(data);
    case "html":
    default:
      return generateHtmlTraceabilityReport(data);
  }
}

function defaultExtension(format: ReportFormat): string {
  return format === "md" ? "md" : format;
}

function resolveFormat(value: string | undefined): ReportFormat {
  if (value === "md" || value === "json" || value === "csv" || value === "html") {
    return value;
  }
  return "html";
}

async function writeReportAndSummarize(
  projectName: string,
  requirements: RequirementInput[],
  workItems: ParsedWorkItem[],
  testCases: ParsedTestCase[],
  importBatches: ImportBatch[],
  ruleset: Ruleset,
  options: CliOptions
): Promise<void> {
  const data = buildProjectDataFromImportedRecords(
    { projectName, requirements, workItems, testCases, importBatches },
    ruleset
  );
  const format = resolveFormat(options.format);
  const outPath = options.out ?? `./doorframe-report.${defaultExtension(format)}`;
  await fs.writeFile(path.resolve(outPath), renderReport(data, format), "utf8");

  const summary = summarizeProjectData(data);
  console.log("Doorframe analysis complete.");
  console.log("");
  console.log(`Requirements: ${summary.requirements}`);
  console.log(`Work items: ${summary.workItems}`);
  console.log(`Tests: ${summary.tests}`);
  console.log(`Trace links: ${summary.traceLinks}`);
  console.log(`Findings: ${summary.findings} (high ${summary.high}, medium ${summary.medium}, low ${summary.low})`);
  console.log("");
  console.log(`Report written to ${outPath}`);
}

async function loadRequirements(options: CliOptions, ruleset: Ruleset): Promise<{
  requirements: RequirementInput[];
  batches: ImportBatch[];
  errors: string[];
}> {
  const requirements: RequirementInput[] = [];
  const batches: ImportBatch[] = [];
  const errors: string[] = [];

  if (options.requirements) {
    const csv = await readUtf8(options.requirements);
    const parsed = parseRequirementsCsv(csv, defaultRequirementsCsvMapping);
    requirements.push(...parsed.records);
    errors.push(...parsed.errors);
    batches.push(importBatch("requirements-csv", options.requirements, parsed.records.length, parsed.errors));
  }

  if (options.reqif) {
    const xml = await readUtf8(options.reqif);
    const parsed = parseReqif(xml);
    requirements.push(...parsed.records);
    errors.push(...parsed.errors);
    batches.push(importBatch("reqif", options.reqif, parsed.records.length, parsed.errors));
  }

  void ruleset;
  return { requirements, batches, errors };
}

async function analyze(args: string[]): Promise<void> {
  if (isHelp(args)) {
    console.log(analyzeUsage("analyze"));
    return;
  }

  const options = parseOptions(args);
  const ruleset = await loadRuleset(options.ruleset);
  const patterns = ruleset.requirementIdPatterns;

  const { requirements, batches } = await loadRequirements(options, ruleset);
  if (requirements.length === 0) {
    throw new Error("Provide --requirements and/or --reqif with at least one requirement.");
  }

  const workItems: ParsedWorkItem[] = [];
  const testCases: ParsedTestCase[] = [];

  if (options.jira) {
    const csv = await readUtf8(options.jira);
    const parsed = parseJiraCsv(csv, defaultJiraCsvMapping, patterns);
    workItems.push(...parsed.records);
    batches.push(importBatch("jira-csv", options.jira, parsed.records.length, parsed.errors));
  }

  if (options.junit) {
    const xml = await readUtf8(options.junit);
    const parsed = parseJUnitXml(xml, patterns);
    testCases.push(...parsed.records);
    batches.push(importBatch("junit-xml", options.junit, parsed.records.length, parsed.errors));
  }

  await writeReportAndSummarize(
    "Doorframe CLI Analysis",
    requirements,
    workItems,
    testCases,
    batches,
    ruleset,
    options
  );
}

async function diff(args: string[]): Promise<void> {
  if (isHelp(args)) {
    console.log(diffUsage());
    return;
  }

  const options = parseOptions(args);
  if (options["baseline-a"] || options["baseline-b"]) {
    const baselineAPath = requireOption(options["baseline-a"], "baseline-a");
    const baselineBPath = requireOption(options["baseline-b"], "baseline-b");
    const ruleset = await loadRuleset(options.ruleset);
    const [baselineACsv, baselineBCsv] = await Promise.all([readUtf8(baselineAPath), readUtf8(baselineBPath)]);
    const baselineA = parseRequirementsCsv(baselineACsv, defaultRequirementsCsvMapping);
    const baselineB = parseRequirementsCsv(baselineBCsv, defaultRequirementsCsvMapping);
    const errors = [...baselineA.errors.map((error) => `baseline-a: ${error}`), ...baselineB.errors.map((error) => `baseline-b: ${error}`)];

    const workItems: ParsedWorkItem[] = [];
    const testCases: ParsedTestCase[] = [];
    if (options.jira) {
      const jira = parseJiraCsv(await readUtf8(options.jira), defaultJiraCsvMapping, ruleset.requirementIdPatterns);
      workItems.push(...jira.records);
      errors.push(...jira.errors.map((error) => `jira: ${error}`));
    }
    if (options.junit) {
      const junit = parseJUnitXml(await readUtf8(options.junit), ruleset.requirementIdPatterns);
      testCases.push(...junit.records);
      errors.push(...junit.errors.map((error) => `junit: ${error}`));
    }

    if (baselineA.records.length === 0 || baselineB.records.length === 0) {
      throw new Error(`Baseline diff requires records in both baselines. ${errors.join(" ")}`.trim());
    }

    const report = compareRequirementBaselines({
      baselineAName: baselineAPath,
      baselineBName: baselineBPath,
      requirementsA: baselineA.records,
      requirementsB: baselineB.records,
      workItems,
      testCases
    });
    const outPath = options.out ?? "./doorframe-baseline-diff.html";
    await fs.writeFile(path.resolve(outPath), generateBaselineDiffHtmlReport(report), "utf8");

    console.log("Doorframe baseline diff complete.");
    console.log("");
    console.log(`Requirements added: ${report.summary.added}`);
    console.log(`Requirements deleted: ${report.summary.deleted}`);
    console.log(`Requirements changed: ${report.summary.changed}`);
    console.log(`High concern changes: ${report.summary.highConcern}`);
    if (errors.length > 0) {
      console.log(`Import warnings: ${errors.length}`);
    }
    console.log("");
    console.log(`Diff report written to ${outPath}`);
    return;
  }

  const basePath = requireOption(options.base, "base");
  const againstPath = requireOption(options.against, "against");

  const base = JSON.parse(await readUtf8(basePath)) as { snapshot?: ProjectSnapshot };
  const against = JSON.parse(await readUtf8(againstPath)) as { snapshot?: ProjectSnapshot };
  if (!base.snapshot || !against.snapshot) {
    throw new Error("Both inputs must be JSON reports produced by `doorframe analyze --format json`.");
  }

  const result = diffBaselines(base.snapshot, against.snapshot);
  console.log("Baseline diff");
  console.log("");
  console.log(`Requirements added:    ${result.requirements.added.join(", ") || "none"}`);
  console.log(`Requirements removed:  ${result.requirements.removed.join(", ") || "none"}`);
  console.log(`Requirements modified: ${result.requirements.modified.map((m) => m.externalId).join(", ") || "none"}`);
  console.log(`Work items: +${result.workItems.added.length} / -${result.workItems.removed.length}`);
  console.log(
    `Tests: +${result.testCases.added.length} / -${result.testCases.removed.length}, status changes: ${result.testCases.statusChanged.length}`
  );
  console.log(`Findings: +${result.findings.added} added, ${result.findings.resolved} resolved`);
}

async function demo(args: string[]): Promise<void> {
  if (isHelp(args)) {
    console.log(demoUsage());
    return;
  }

  const options = parseOptions(args);
  const requirements = await resolveDemoFile("sample-requirements-baseline-b.csv");
  const baselineA = await resolveDemoFile("sample-requirements-baseline-a.csv");
  const baselineB = await resolveDemoFile("sample-requirements-baseline-b.csv");
  const jira = await resolveDemoFile("sample-jira.csv");
  const junit = await resolveDemoFile("sample-junit.xml");
  const reportOut = options.out ?? "./doorframe-report.html";
  const diffOut = options["diff-out"] ?? "./doorframe-baseline-diff.html";

  await analyze([
    "--requirements",
    requirements,
    "--jira",
    jira,
    "--junit",
    junit,
    "--out",
    reportOut
  ]);

  if (options["skip-diff"] !== "true") {
    console.log("");
    await diff([
      "--baseline-a",
      baselineA,
      "--baseline-b",
      baselineB,
      "--jira",
      jira,
      "--junit",
      junit,
      "--out",
      diffOut
    ]);
  }
}

async function serve(args: string[]): Promise<void> {
  if (isHelp(args)) {
    console.log(serveUsage());
    return;
  }

  const options = parseOptions(args);
  const serverPath = await resolveWebServer();
  const port = options.port ?? process.env.PORT ?? "3000";
  const host = options.host ?? process.env.HOSTNAME ?? "127.0.0.1";
  const dataDir = options["data-dir"] ?? process.env.DOORFRAME_DATA_DIR ?? path.resolve(process.cwd(), ".doorframe");
  const displayHost = host === "0.0.0.0" ? "localhost" : host;

  console.log(`Starting Doorframe web app at http://${displayHost}:${port}`);
  console.log(`Using local data directory: ${dataDir}`);
  console.log("Press Ctrl+C to stop.");

  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      DOORFRAME_DATA_DIR: dataDir,
      HOSTNAME: host,
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_ENV: "production",
      PORT: port
    },
    stdio: "inherit"
  });

  const forwardedSignals = ["SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT"] as const;
  for (const signal of forwardedSignals) {
    process.on(signal, () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(signal);
      }
    });
  }

  await new Promise<void>((resolve) => {
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 0;
      resolve();
    });
  });
}

async function importConnector(kind: "jira" | "github" | "gitlab" | "jenkins", args: string[]): Promise<void> {
  const options = parseOptions(args);
  const ruleset = await loadRuleset(options.ruleset);
  const patterns = ruleset.requirementIdPatterns;
  const { requirements, batches } = await loadRequirements(options, ruleset);

  const workItems: ParsedWorkItem[] = [];
  const testCases: ParsedTestCase[] = [];

  if (kind === "jira") {
    const config = jiraConfigFromEnv(options.jql);
    if (!config) {
      throw new Error("Set DOORFRAME_JIRA_BASE_URL, DOORFRAME_JIRA_EMAIL, and DOORFRAME_JIRA_API_TOKEN.");
    }
    const result = await fetchJiraIssues(config, undefined, patterns);
    if (result.errors.length > 0) throw new Error(result.errors.join("; "));
    workItems.push(...result.records);
    batches.push(importBatch("jira-api", config.baseUrl, result.records.length, result.errors));
  } else if (kind === "github") {
    const config = githubConfigFromEnv(options.owner, options.repo);
    if (!config) throw new Error("Set DOORFRAME_GITHUB_TOKEN, DOORFRAME_GITHUB_OWNER, DOORFRAME_GITHUB_REPO.");
    if (options["junit-xml"]) {
      config.junitXml = await readUtf8(options["junit-xml"]);
    }
    if (options["run-id"]) config.runId = options["run-id"];
    const result = await fetchGithubJunit(config, undefined, patterns);
    if (result.errors.length > 0) throw new Error(result.errors.join("; "));
    testCases.push(...result.records);
    batches.push(importBatch("github", `${config.owner}/${config.repo}`, result.records.length, result.errors));
  } else if (kind === "gitlab") {
    const config = gitlabConfigFromEnv(options["project-id"], options["job-id"]);
    if (!config) throw new Error("Set DOORFRAME_GITLAB_TOKEN, DOORFRAME_GITLAB_PROJECT_ID, DOORFRAME_GITLAB_JOB_ID.");
    const result = await fetchGitlabJunit(config, undefined, patterns);
    if (result.errors.length > 0) throw new Error(result.errors.join("; "));
    testCases.push(...result.records);
    batches.push(importBatch("gitlab", String(config.projectId), result.records.length, result.errors));
  } else {
    const config = jenkinsConfigFromEnv(options.job, options.build);
    if (!config) throw new Error("Set DOORFRAME_JENKINS_BASE_URL and DOORFRAME_JENKINS_JOB.");
    const result = await fetchJenkinsTestReport(config, undefined, patterns);
    if (result.errors.length > 0) throw new Error(result.errors.join("; "));
    testCases.push(...result.records);
    batches.push(importBatch("jenkins", config.job, result.records.length, result.errors));
  }

  if (requirements.length === 0) {
    console.log(`Fetched ${workItems.length} work item(s) and ${testCases.length} test(s).`);
    console.log("Provide --requirements (or --reqif) to generate a full traceability report.");
    return;
  }

  await writeReportAndSummarize(
    `Doorframe ${kind} import`,
    requirements,
    workItems,
    testCases,
    batches,
    ruleset,
    options
  );
}

async function runMcp(args: string[]): Promise<void> {
  if (isHelp(args)) {
    console.error(mcpUsageText.replaceAll("doorframe-mcp", "doorframe mcp"));
    return;
  }

  const options = parseOptions(args);
  const projectDb = loadProjectDb(options.project);
  await runStdioServer(projectDb);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  switch (command) {
    case "demo":
      await demo(args);
      return;
    case "serve":
      await serve(args);
      return;
    case "server":
      await serve(args);
      return;
    case "analyze":
      await analyze(args);
      return;
    case "report":
      if (isHelp(args)) {
        console.log(analyzeUsage("report"));
        return;
      }
      await analyze(args);
      return;
    case "diff":
      await diff(args);
      return;
    case "mcp":
      await runMcp(args);
      return;
    case "import-jira":
      await importConnector("jira", args);
      return;
    case "import-github":
      await importConnector("github", args);
      return;
    case "import-gitlab":
      await importConnector("gitlab", args);
      return;
    case "import-jenkins":
      await importConnector("jenkins", args);
      return;
    default:
      console.log(usage());
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Doorframe CLI failed.");
  process.exitCode = 1;
});
