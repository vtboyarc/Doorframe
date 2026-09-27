import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseJiraCsv, parseJUnitXml, parseRequirementsCsv } from "@doorframe/parsers";
import { defaultJiraCsvMapping, defaultRequirementsCsvMapping } from "@doorframe/storage";
import type { ProjectData } from "@doorframe/core";
import {
  createProject,
  getDb,
  getProjectData,
  listTraceReferences,
  removeRecords
} from "./db";
import { loadDemoProject, saveJiraRecords, saveJunitRecords, saveRequirementRecords } from "./imports";

// These tests exercise the real SQLite storage in a throwaway data directory.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-web-imports-"));
const examples = path.resolve(__dirname, "../../../../examples/falcon-telemetry-gateway");
const read = (name: string) => fs.readFileSync(path.join(examples, name), "utf8");

const requirementsB = () => parseRequirementsCsv(read("sample-requirements-baseline-b.csv"), defaultRequirementsCsvMapping).records;
const requirementsA = () => parseRequirementsCsv(read("sample-requirements-baseline-a.csv"), defaultRequirementsCsvMapping).records;
const jira = () => parseJiraCsv(read("sample-jira.csv"), defaultJiraCsvMapping).records;
const junit = () => parseJUnitXml(read("sample-junit.xml")).records;

/** Links as "REQ-001 implements FG-12" so projects can be compared by external IDs. */
function linkLabels(data: ProjectData): string[] {
  const names = new Map<string, string>([
    ...data.requirements.map((item) => [item.id, item.externalId] as const),
    ...data.workItems.map((item) => [item.id, item.externalId] as const),
    ...data.testCases.map((item) => [item.id, item.externalId] as const)
  ]);
  return data.traceLinks.map((link) => `${names.get(link.sourceId)} ${link.linkType} ${names.get(link.targetId)}`).sort();
}

function project(name: string): string {
  return createProject(name).id;
}

beforeAll(() => {
  process.env.DOORFRAME_DATA_DIR = dataDir;
});

afterAll(() => {
  getDb().close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("web import storage", () => {
  it("creates the same trace links whichever file is imported first", async () => {
    const demoProject = project("Demo order");
    await loadDemoProject(demoProject);
    const expected = linkLabels(getProjectData(demoProject)!);

    const reversed = project("Tests and work items first");
    expect(saveJiraRecords(reversed, jira()).linkCount).toBe(0);
    expect(saveJunitRecords(reversed, junit()).linkCount).toBe(0);
    const requirementSave = saveRequirementRecords(reversed, requirementsB());

    expect(requirementSave.linkCount).toBe(expected.length);
    expect(linkLabels(getProjectData(reversed)!)).toEqual(expected);
    expect(expected.length).toBe(93);
  });

  it("drops links a re-imported work item no longer mentions", () => {
    const projectId = project("Re-import work item");
    saveRequirementRecords(projectId, requirementsB());
    const workItems = jira();
    saveJiraRecords(projectId, workItems);

    const target = workItems.find((item) => item.requirementIds.length > 1)!;
    const [kept, ...dropped] = target.requirementIds;
    const result = saveJiraRecords(projectId, [{ ...target, requirementIds: [kept] }]);

    const labels = linkLabels(getProjectData(projectId)!);
    expect(labels).toContain(`${kept} implements ${target.externalId}`);
    dropped.forEach((requirementId) => expect(labels).not.toContain(`${requirementId} implements ${target.externalId}`));
    expect(result).toMatchObject({ recordCount: 1, createdCount: 0, updatedCount: 1, linkCount: 0 });
    expect(result.missingExternalIds).toHaveLength(workItems.length - 1);
  });

  it("reports new, updated, and missing requirements on re-import", () => {
    const projectId = project("Baseline re-import");
    const first = saveRequirementRecords(projectId, requirementsA());
    expect(first).toMatchObject({ createdCount: 42, updatedCount: 0, missingExternalIds: [] });

    const second = saveRequirementRecords(projectId, requirementsB());
    expect(second).toMatchObject({ recordCount: 42, createdCount: 1, updatedCount: 41, missingExternalIds: ["REQ-042"] });
  });

  it("removes records with their links, and relinks a removed requirement when it returns", () => {
    const projectId = project("Remove records");
    saveRequirementRecords(projectId, requirementsB());
    const workItems = jira();
    saveJiraRecords(projectId, workItems);
    const linked = workItems.find((item) => item.requirementIds.includes("REQ-001"))!;
    const before = linkLabels(getProjectData(projectId)!);

    const removedWork = removeRecords(projectId, "workItem", [linked.externalId, "FG-DOES-NOT-EXIST"]);
    expect(removedWork.removedExternalIds).toEqual([linked.externalId]);
    expect(removedWork.removedLinkCount).toBe(linked.requirementIds.length);
    expect(listTraceReferences(projectId).some((reference) => reference.entityExternalId === linked.externalId)).toBe(false);

    saveJiraRecords(projectId, [linked]);
    const removedRequirement = removeRecords(projectId, "requirement", ["REQ-001"]);
    expect(removedRequirement.removedExternalIds).toEqual(["REQ-001"]);
    expect(linkLabels(getProjectData(projectId)!).some((label) => label.startsWith("REQ-001 "))).toBe(false);

    // References from work items survive, so re-importing the requirement restores its links.
    saveRequirementRecords(projectId, requirementsB());
    expect(linkLabels(getProjectData(projectId)!)).toEqual(before);
  });
});
