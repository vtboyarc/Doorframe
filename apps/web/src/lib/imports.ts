import fs from "node:fs/promises";
import path from "node:path";
import {
  type Baseline,
  type RequirementInput,
  type TestCaseInput,
  type TraceLinkInput,
  type WorkItemInput
} from "@doorframe/core";
import type { RequirementIdPattern } from "@doorframe/core";
import {
  parseJiraCsv,
  parseJUnitXml,
  parseReqif,
  parseReqifz,
  parseRequirementsCsv,
  type ParsedTestCase,
  type ParsedWorkItem
} from "@doorframe/parsers";
import {
  buildProjectDataFromImportedRecords,
  defaultJiraCsvMapping,
  defaultRequirementsCsvMapping
} from "@doorframe/storage";
import {
  createBaseline,
  deleteTraceLinksById,
  getProjectData,
  getRequirements,
  getRuleset,
  getTraceLinks,
  listBaselines,
  listRecordIds,
  listTraceReferences,
  replaceTraceReferences,
  runImportTransaction,
  saveBaselineSnapshot,
  saveRequirements,
  saveTestCases,
  saveTraceLink,
  saveWorkItems
} from "./db";
import {
  blankUnmappedJiraFields,
  blankUnmappedRequirementFields,
  countCreatedAndUpdated,
  missingExternalIds
} from "./import-records";
import type { ColumnMapping, ImportSourceType } from "./import-types";
import {
  buildTraceReferences,
  planLinkSync,
  planParentLinks,
  planReferenceLinks,
  referenceRule,
  traceLinkKey,
  type ReferencingEntityType
} from "./trace-references";

export interface SaveParsedResult {
  recordCount: number;
  createdCount: number;
  updatedCount: number;
  /** Trace links this save created. Links that already existed are not counted. */
  linkCount: number;
  /** Sorted external IDs of same-kind records that existed before this save but are not in it. */
  missingExternalIds: string[];
}

function externalIdToId(projectId: string, entityType: "requirement" | ReferencingEntityType): Map<string, string> {
  return new Map(listRecordIds(projectId, entityType).map((record) => [record.externalId, record.id]));
}

function createLinks(projectId: string, links: TraceLinkInput[]): number {
  links.forEach((link) => saveTraceLink(projectId, link));
  return links.length;
}

function saveSummary(existing: Map<string, string>, savedExternalIds: string[], linkCount: number): SaveParsedResult {
  const existingIds = new Set(existing.keys());
  return {
    ...countCreatedAndUpdated(existingIds, savedExternalIds),
    linkCount,
    missingExternalIds: missingExternalIds(existingIds, savedExternalIds)
  };
}

/**
 * Create every link the project's requirements now allow: parent links for
 * children imported before their parent, and links from work items and tests
 * whose stored references name these requirements.
 */
function linkStoredReferences(projectId: string): number {
  const requirementIdByExternalId = externalIdToId(projectId, "requirement");
  const existingLinkKeys = new Set(getTraceLinks(projectId).map(traceLinkKey));
  const parentLinks = planParentLinks({
    requirements: getRequirements(projectId),
    requirementIdByExternalId,
    existingLinkKeys
  });
  const referenceLinks = planReferenceLinks({
    references: listTraceReferences(projectId),
    requirementIdByExternalId,
    entityIdByExternalId: {
      workItem: externalIdToId(projectId, "workItem"),
      testCase: externalIdToId(projectId, "testCase")
    },
    existingLinkKeys
  });

  return createLinks(projectId, [...parentLinks, ...referenceLinks]);
}

/**
 * Store what the imported work items or tests reference now, then make their
 * links match: add links to referenced requirements that exist and drop links
 * to requirements they no longer mention. Returns the number of links created.
 */
function syncReferencedLinks(
  projectId: string,
  entityType: ReferencingEntityType,
  source: string,
  parsed: Array<{ externalId: string; requirementIds: string[] }>,
  saved: Array<{ id: string; externalId: string }>
): number {
  replaceTraceReferences(
    projectId,
    entityType,
    parsed.map((entity) => entity.externalId),
    buildTraceReferences(entityType, parsed, source)
  );

  // A JUnit file can repeat a test case; merge its references before planning.
  const savedIds = new Map(saved.map((entity) => [entity.externalId, entity.id]));
  const referencesByEntity = new Map<string, Set<string>>();
  parsed.forEach((entity) => {
    const entityId = savedIds.get(entity.externalId);
    if (entityId) {
      const ids = referencesByEntity.get(entityId) ?? new Set<string>();
      entity.requirementIds.forEach((id) => ids.add(id));
      referencesByEntity.set(entityId, ids);
    }
  });

  const linkType = referenceRule(entityType).linkType;
  const plan = planLinkSync({
    entityType,
    source,
    entities: Array.from(referencesByEntity, ([entityId, ids]) => ({ entityId, requirementExternalIds: Array.from(ids) })),
    requirementIdByExternalId: externalIdToId(projectId, "requirement"),
    existingLinks: getTraceLinks(projectId)
      .filter(
        (link) => link.sourceType === "requirement" && link.targetType === entityType && link.linkType === linkType
      )
      .map((link) => ({ linkId: link.id, requirementId: link.sourceId, entityId: link.targetId }))
  });

  deleteTraceLinksById(projectId, plan.deleteLinkIds);
  return createLinks(projectId, plan.create);
}

export function saveRequirementRecords(projectId: string, records: RequirementInput[]): SaveParsedResult {
  return runImportTransaction(() => {
    const existing = externalIdToId(projectId, "requirement");
    const saved = saveRequirements(projectId, records);
    const linkCount = linkStoredReferences(projectId);
    return saveSummary(existing, saved.map((requirement) => requirement.externalId), linkCount);
  });
}

export function saveJiraRecords(projectId: string, workItems: ParsedWorkItem[]): SaveParsedResult {
  return runImportTransaction(() => {
    const existing = externalIdToId(projectId, "workItem");
    const saved = saveWorkItems(projectId, workItems as WorkItemInput[]);
    const linkCount = syncReferencedLinks(projectId, "workItem", "jira-csv", workItems, saved);
    return saveSummary(existing, saved.map((workItem) => workItem.externalId), linkCount);
  });
}

export function saveJunitRecords(projectId: string, testCases: ParsedTestCase[]): SaveParsedResult {
  return runImportTransaction(() => {
    const existing = externalIdToId(projectId, "testCase");
    const saved = saveTestCases(projectId, testCases as TestCaseInput[]);
    const linkCount = syncReferencedLinks(projectId, "testCase", "junit-xml", testCases, saved);
    return saveSummary(existing, saved.map((testCase) => testCase.externalId), linkCount);
  });
}

/** Records read from one uploaded file, before anything is saved. */
export type ParsedImportFile =
  | { entityType: "requirement"; records: RequirementInput[]; errors: string[] }
  | { entityType: "workItem"; records: ParsedWorkItem[]; errors: string[] }
  | { entityType: "testCase"; records: ParsedTestCase[]; errors: string[] };

/**
 * Parse an uploaded file as the chosen import type. Throws the parser's error
 * (csv-parse, XML, JSZip) when the file cannot be read at all. For CSV types,
 * optional fields the form set to "Not imported" are blanked after parsing.
 */
export async function parseImportFile(input: {
  sourceType: ImportSourceType;
  text: string;
  buffer: Buffer;
  mapping: ColumnMapping;
  patterns: RequirementIdPattern[];
}): Promise<ParsedImportFile> {
  switch (input.sourceType) {
    case "requirements-csv": {
      const result = parseRequirementsCsv(input.text, input.mapping);
      return {
        entityType: "requirement",
        records: blankUnmappedRequirementFields(result.records, input.mapping),
        errors: result.errors
      };
    }
    case "jira-csv": {
      const result = parseJiraCsv(input.text, input.mapping, input.patterns);
      return {
        entityType: "workItem",
        records: blankUnmappedJiraFields(result.records, input.mapping),
        errors: result.errors
      };
    }
    case "junit-xml": {
      const result = parseJUnitXml(input.text, input.patterns);
      return { entityType: "testCase", records: result.records, errors: result.errors };
    }
    case "reqif": {
      const result = parseReqif(input.text);
      return { entityType: "requirement", records: result.records, errors: result.errors };
    }
    case "reqifz": {
      const result = await parseReqifz(input.buffer);
      return { entityType: "requirement", records: result.records, errors: result.errors };
    }
  }
}

export function saveParsedImport(projectId: string, parsed: ParsedImportFile): SaveParsedResult {
  switch (parsed.entityType) {
    case "requirement":
      return saveRequirementRecords(projectId, parsed.records);
    case "workItem":
      return saveJiraRecords(projectId, parsed.records);
    case "testCase":
      return saveJunitRecords(projectId, parsed.records);
  }
}

async function examplesDir(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "examples", "falcon-telemetry-gateway"),
    path.resolve(process.cwd(), "../..", "examples", "falcon-telemetry-gateway"),
    path.join(process.cwd(), "examples"),
    path.resolve(process.cwd(), "../..", "examples")
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, "sample-requirements-baseline-b.csv"));
      return candidate;
    } catch {
      // Try the next likely workspace layout.
    }

    try {
      await fs.access(path.join(candidate, "sample-requirements.csv"));
      return candidate;
    } catch {
      // Try the next likely workspace layout.
    }
  }

  throw new Error("Could not find Doorframe examples directory.");
}

export const DEMO_BASELINE_LABELS = {
  previous: "Demo baseline A (previous review)",
  current: "Demo baseline B (current review)"
} as const;

/** Parsed demo inputs kept so the demo baselines can be built after analysis runs. */
export interface DemoInputs {
  previousRequirements: RequirementInput[] | null;
  workItems: ParsedWorkItem[];
  testCases: ParsedTestCase[];
}

export async function loadDemoProject(projectId: string): Promise<{
  recordCount: number;
  linkCount: number;
  errors: string[];
  inputs: DemoInputs;
}> {
  const dir = await examplesDir();
  const [requirementsCsv, previousRequirementsCsv, jiraCsv, junitXml] = await Promise.all([
    fs
      .readFile(path.join(dir, "sample-requirements-baseline-b.csv"), "utf8")
      .catch(() => fs.readFile(path.join(dir, "sample-requirements.csv"), "utf8")),
    fs.readFile(path.join(dir, "sample-requirements-baseline-a.csv"), "utf8").catch(() => null),
    fs.readFile(path.join(dir, "sample-jira.csv"), "utf8"),
    fs.readFile(path.join(dir, "sample-junit.xml"), "utf8")
  ]);
  const requirements = parseRequirementsCsv(requirementsCsv, defaultRequirementsCsvMapping);
  const jira = parseJiraCsv(jiraCsv, defaultJiraCsvMapping);
  const junit = parseJUnitXml(junitXml);
  const requirementSave = saveRequirementRecords(projectId, requirements.records);
  const jiraSave = saveJiraRecords(projectId, jira.records);
  const junitSave = saveJunitRecords(projectId, junit.records);

  return {
    recordCount: requirementSave.recordCount + jiraSave.recordCount + junitSave.recordCount,
    linkCount: requirementSave.linkCount + jiraSave.linkCount + junitSave.linkCount,
    errors: [...requirements.errors, ...jira.errors, ...junit.errors],
    inputs: {
      previousRequirements: previousRequirementsCsv
        ? parseRequirementsCsv(previousRequirementsCsv, defaultRequirementsCsvMapping).records
        : null,
      workItems: jira.records,
      testCases: junit.records
    }
  };
}

/**
 * Give the demo project two baselines so the baseline comparison has something
 * to show: A is built in memory from the earlier fictional requirements export,
 * B is captured from the project's current (analyzed) data. Call after analysis
 * has run. Skips when the demo baselines already exist. Returns the baselines created.
 */
export function createDemoBaselines(projectId: string, inputs: DemoInputs): Baseline[] {
  const current = getProjectData(projectId);
  if (!inputs.previousRequirements || !current) {
    return [];
  }

  const existingLabels = new Set(listBaselines(projectId).map((baseline) => baseline.label));
  if (existingLabels.has(DEMO_BASELINE_LABELS.previous) && existingLabels.has(DEMO_BASELINE_LABELS.current)) {
    return [];
  }

  const previous = buildProjectDataFromImportedRecords(
    {
      projectName: "Falcon Telemetry Gateway (previous review)",
      requirements: inputs.previousRequirements,
      workItems: inputs.workItems,
      testCases: inputs.testCases
    },
    getRuleset(projectId)
  );

  // Baseline diffs compare trace links by internal entity id, so reuse the ids
  // of the matching (same external id) records already stored in this project.
  const idMap = new Map<string, string>();
  function adopt<T extends { id: string; externalId: string; projectId: string }>(
    items: T[],
    stored: Array<{ id: string; externalId: string }>
  ): T[] {
    const storedIds = new Map(stored.map((item) => [item.externalId, item.id]));
    return items.map((item) => {
      const id = storedIds.get(item.externalId) ?? item.id;
      idMap.set(item.id, id);
      return { ...item, id, projectId };
    });
  }
  const mapId = (id: string) => idMap.get(id) ?? id;

  const created = [
    saveBaselineSnapshot(projectId, DEMO_BASELINE_LABELS.previous, {
      requirements: adopt(previous.requirements, current.requirements),
      workItems: adopt(previous.workItems, current.workItems),
      testCases: adopt(previous.testCases, current.testCases),
      traceLinks: previous.traceLinks.map((link) => ({
        ...link,
        projectId,
        sourceId: mapId(link.sourceId),
        targetId: mapId(link.targetId)
      })),
      findings: previous.findings.map((finding) => ({ ...finding, projectId, entityId: mapId(finding.entityId) }))
    })
  ];
  const currentBaseline = createBaseline(projectId, DEMO_BASELINE_LABELS.current);
  if (currentBaseline) {
    created.push(currentBaseline);
  }

  return created;
}
