#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import { generateHtmlTraceabilityReport } from "@doorframe/reporting";
import { parseJiraCsv, parseJUnitXml, parseRequirementsCsv } from "@doorframe/parsers";
import {
  buildProjectDataFromImportedRecords,
  defaultJiraCsvMapping,
  defaultRequirementsCsvMapping,
  summarizeProjectData
} from "@doorframe/storage";
import type { ImportBatch } from "@doorframe/core";

interface AnalyzeOptions {
  requirements?: string;
  jira?: string;
  junit?: string;
  out?: string;
}

function usage(): string {
  return `Doorframe CLI

Usage:
  doorframe analyze --requirements ./requirements.csv --jira ./jira.csv --junit ./test-results.xml --out ./doorframe-report.html

Options:
  --requirements <path>  Requirements CSV export
  --jira <path>          Jira CSV export
  --junit <path>         JUnit XML test result file
  --out <path>           HTML report output path
`;
}

function parseAnalyzeOptions(args: string[]): AnalyzeOptions {
  const options: AnalyzeOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--requirements") {
      options.requirements = next;
      index += 1;
    } else if (arg === "--jira") {
      options.jira = next;
      index += 1;
    } else if (arg === "--junit") {
      options.junit = next;
      index += 1;
    } else if (arg === "--out") {
      options.out = next;
      index += 1;
    }
  }

  return options;
}

function requireOption(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required option ${name}.`);
  }

  return value;
}

async function readUtf8(filePath: string): Promise<string> {
  return fs.readFile(path.resolve(filePath), "utf8");
}

function importBatch(sourceType: string, filename: string, recordCount: number, errors: string[]): ImportBatch {
  const importedAt = new Date().toISOString();

  return {
    id: `import_${sourceType}`,
    projectId: "project_cli",
    sourceType,
    filename,
    importedAt,
    recordCount,
    errors
  };
}

async function analyze(args: string[]): Promise<void> {
  const options = parseAnalyzeOptions(args);
  const requirementsPath = requireOption(options.requirements, "--requirements");
  const jiraPath = requireOption(options.jira, "--jira");
  const junitPath = requireOption(options.junit, "--junit");
  const outPath = options.out ?? "./doorframe-report.html";

  const [requirementsCsv, jiraCsv, junitXml] = await Promise.all([
    readUtf8(requirementsPath),
    readUtf8(jiraPath),
    readUtf8(junitPath)
  ]);
  const requirements = parseRequirementsCsv(requirementsCsv, defaultRequirementsCsvMapping);
  const workItems = parseJiraCsv(jiraCsv, defaultJiraCsvMapping);
  const testCases = parseJUnitXml(junitXml);
  const data = buildProjectDataFromImportedRecords({
    projectName: "Doorframe CLI Analysis",
    requirements: requirements.records,
    workItems: workItems.records,
    testCases: testCases.records,
    importBatches: [
      importBatch("requirements-csv", requirementsPath, requirements.records.length, requirements.errors),
      importBatch("jira-csv", jiraPath, workItems.records.length, workItems.errors),
      importBatch("junit-xml", junitPath, testCases.records.length, testCases.errors)
    ]
  });
  const html = generateHtmlTraceabilityReport(data);

  await fs.writeFile(path.resolve(outPath), html, "utf8");

  const summary = summarizeProjectData(data);
  const parseErrors = [...requirements.errors, ...workItems.errors, ...testCases.errors];

  console.log("Doorframe analysis complete.");
  console.log("");
  console.log(`Requirements: ${summary.requirements}`);
  console.log(`Work items: ${summary.workItems}`);
  console.log(`Tests: ${summary.tests}`);
  console.log(`Trace links: ${summary.traceLinks}`);
  console.log(`Findings: ${summary.findings}`);
  console.log("");
  console.log(`High: ${summary.high}`);
  console.log(`Medium: ${summary.medium}`);
  console.log(`Low: ${summary.low}`);
  console.log("");
  console.log(`Report written to ${outPath}`);

  if (parseErrors.length > 0) {
    console.log("");
    console.log("Import warnings:");
    parseErrors.forEach((error) => console.log(`- ${error}`));
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "analyze") {
    await analyze(args);
    return;
  }

  console.log(usage());
  process.exitCode = command ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Doorframe CLI failed.");
  process.exitCode = 1;
});
