import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  createId,
  nowIso,
  safeJsonParse,
  safeJsonStringify,
  type Finding,
  type FindingInput,
  type ImportBatch,
  type Project,
  type ProjectData,
  type ProjectSummary,
  type Requirement,
  type RequirementInput,
  type TestCase,
  type TestCaseInput,
  type TraceLink,
  type TraceLinkInput,
  type WorkItem,
  type WorkItemInput
} from "@doorframe/core";

type Db = Database.Database;

interface ProjectRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface RequirementRow {
  id: string;
  project_id: string;
  external_id: string;
  title: string;
  text: string;
  source: string;
  type: string | null;
  status: string | null;
  priority: string | null;
  verification_method: string | null;
  parent_external_id: string | null;
  raw_attributes: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkItemRow {
  id: string;
  project_id: string;
  external_id: string;
  title: string;
  description: string | null;
  status: string | null;
  type: string | null;
  assignee: string | null;
  source: string;
  raw_attributes: string | null;
  created_at: string;
  updated_at: string;
}

interface TestCaseRow {
  id: string;
  project_id: string;
  external_id: string;
  name: string;
  classname: string | null;
  status: "passed" | "failed" | "skipped";
  duration: number | null;
  failure_message: string | null;
  source: string;
  raw_attributes: string | null;
  created_at: string;
  updated_at: string;
}

interface TraceLinkRow {
  id: string;
  project_id: string;
  source_type: "requirement" | "workItem" | "testCase";
  source_id: string;
  target_type: "requirement" | "workItem" | "testCase";
  target_id: string;
  link_type: "implements" | "verifies" | "references" | "parent" | "derived";
  confidence: number;
  source: string;
  created_at: string;
  updated_at: string;
}

interface FindingRow {
  id: string;
  project_id: string;
  severity: "info" | "warning" | "error";
  category: Finding["category"];
  title: string;
  description: string;
  entity_type: "requirement" | "workItem" | "testCase";
  entity_id: string;
  recommendation: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportBatchRow {
  id: string;
  project_id: string;
  source_type: string;
  filename: string;
  imported_at: string;
  record_count: number;
  errors: string | null;
}

const globalForDb = globalThis as unknown as { doorframeDb?: Db };

function databasePath(): string {
  const dataDir = process.env.DOORFRAME_DATA_DIR ?? path.join(process.cwd(), ".doorframe");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "doorframe.sqlite");
}

export function getDb(): Db {
  if (!globalForDb.doorframeDb) {
    const db = new Database(databasePath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalForDb.doorframeDb = db;
  }

  return globalForDb.doorframeDb;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT,
      status TEXT,
      priority TEXT,
      verification_method TEXT,
      parent_external_id TEXT,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT,
      type TEXT,
      assignee TEXT,
      source TEXT NOT NULL,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      classname TEXT,
      status TEXT NOT NULL,
      duration REAL,
      failure_message TEXT,
      source TEXT NOT NULL,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS trace_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, source_type, source_id, target_type, target_id, link_type)
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      recommendation TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      errors TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);
    CREATE INDEX IF NOT EXISTS idx_work_items_project_id ON work_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
    CREATE INDEX IF NOT EXISTS idx_trace_links_project_id ON trace_links(project_id);
    CREATE INDEX IF NOT EXISTS idx_findings_project_id ON findings(project_id);
  `);
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requirementFromRow(row: RequirementRow): Requirement {
  return {
    id: row.id,
    projectId: row.project_id,
    externalId: row.external_id,
    title: row.title,
    text: row.text,
    source: row.source,
    type: row.type ?? undefined,
    status: row.status ?? undefined,
    priority: row.priority ?? undefined,
    verificationMethod: row.verification_method ?? undefined,
    parentExternalId: row.parent_external_id ?? undefined,
    rawAttributes: safeJsonParse(row.raw_attributes),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function workItemFromRow(row: WorkItemRow): WorkItem {
  return {
    id: row.id,
    projectId: row.project_id,
    externalId: row.external_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status ?? undefined,
    type: row.type ?? undefined,
    assignee: row.assignee ?? undefined,
    source: row.source,
    rawAttributes: safeJsonParse(row.raw_attributes),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function testCaseFromRow(row: TestCaseRow): TestCase {
  return {
    id: row.id,
    projectId: row.project_id,
    externalId: row.external_id,
    name: row.name,
    classname: row.classname ?? undefined,
    status: row.status,
    duration: row.duration ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    source: row.source,
    rawAttributes: safeJsonParse(row.raw_attributes),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function traceLinkFromRow(row: TraceLinkRow): TraceLink {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetType: row.target_type,
    targetId: row.target_id,
    linkType: row.link_type,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findingFromRow(row: FindingRow): Finding {
  return {
    id: row.id,
    projectId: row.project_id,
    severity: row.severity,
    category: row.category,
    title: row.title,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    recommendation: row.recommendation ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function importBatchFromRow(row: ImportBatchRow): ImportBatch {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type,
    filename: row.filename,
    importedAt: row.imported_at,
    recordCount: row.record_count,
    errors: JSON.parse(row.errors ?? "[]") as string[]
  };
}

export function listProjects(): Project[] {
  const rows = getDb()
    .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
    .all() as ProjectRow[];
  return rows.map(projectFromRow);
}

export function createProject(name: string): Project {
  const now = nowIso();
  const project: Project = {
    id: createId("project"),
    name: name.trim() || "Untitled Project",
    createdAt: now,
    updatedAt: now
  };

  getDb()
    .prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(project.id, project.name, project.createdAt, project.updatedAt);

  return project;
}

export function getProject(projectId: string): Project | null {
  const row = getDb()
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(projectId) as ProjectRow | undefined;

  return row ? projectFromRow(row) : null;
}

export function touchProject(projectId: string): void {
  getDb().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), projectId);
}

export function getRequirements(projectId: string): Requirement[] {
  const rows = getDb()
    .prepare("SELECT * FROM requirements WHERE project_id = ? ORDER BY external_id")
    .all(projectId) as RequirementRow[];
  return rows.map(requirementFromRow);
}

export function getWorkItems(projectId: string): WorkItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM work_items WHERE project_id = ? ORDER BY external_id")
    .all(projectId) as WorkItemRow[];
  return rows.map(workItemFromRow);
}

export function getTestCases(projectId: string): TestCase[] {
  const rows = getDb()
    .prepare("SELECT * FROM test_cases WHERE project_id = ? ORDER BY classname, name")
    .all(projectId) as TestCaseRow[];
  return rows.map(testCaseFromRow);
}

export function getTraceLinks(projectId: string): TraceLink[] {
  const rows = getDb()
    .prepare("SELECT * FROM trace_links WHERE project_id = ? ORDER BY created_at")
    .all(projectId) as TraceLinkRow[];
  return rows.map(traceLinkFromRow);
}

export function getFindings(projectId: string): Finding[] {
  const rows = getDb()
    .prepare("SELECT * FROM findings WHERE project_id = ? ORDER BY severity DESC, category, title")
    .all(projectId) as FindingRow[];
  return rows.map(findingFromRow);
}

export function getImportBatches(projectId: string): ImportBatch[] {
  const rows = getDb()
    .prepare("SELECT * FROM import_batches WHERE project_id = ? ORDER BY imported_at DESC")
    .all(projectId) as ImportBatchRow[];
  return rows.map(importBatchFromRow);
}

export function getRequirement(projectId: string, requirementId: string): Requirement | null {
  const row = getDb()
    .prepare("SELECT * FROM requirements WHERE project_id = ? AND (id = ? OR external_id = ?)")
    .get(projectId, requirementId, requirementId) as RequirementRow | undefined;
  return row ? requirementFromRow(row) : null;
}

export function getProjectData(projectId: string): ProjectData | null {
  const project = getProject(projectId);
  if (!project) {
    return null;
  }

  return {
    project,
    requirements: getRequirements(projectId),
    workItems: getWorkItems(projectId),
    testCases: getTestCases(projectId),
    traceLinks: getTraceLinks(projectId),
    findings: getFindings(projectId),
    importBatches: getImportBatches(projectId)
  };
}

export function getRequirementByExternalId(projectId: string, externalId: string): Requirement | null {
  const row = getDb()
    .prepare("SELECT * FROM requirements WHERE project_id = ? AND external_id = ?")
    .get(projectId, externalId) as RequirementRow | undefined;
  return row ? requirementFromRow(row) : null;
}

export function getWorkItemByExternalId(projectId: string, externalId: string): WorkItem | null {
  const row = getDb()
    .prepare("SELECT * FROM work_items WHERE project_id = ? AND external_id = ?")
    .get(projectId, externalId) as WorkItemRow | undefined;
  return row ? workItemFromRow(row) : null;
}

export function getTestCaseByExternalId(projectId: string, externalId: string): TestCase | null {
  const row = getDb()
    .prepare("SELECT * FROM test_cases WHERE project_id = ? AND external_id = ?")
    .get(projectId, externalId) as TestCaseRow | undefined;
  return row ? testCaseFromRow(row) : null;
}

export const saveRequirements = (projectId: string, records: RequirementInput[]): Requirement[] =>
  getDb().transaction((inputs: RequirementInput[]) => {
    const saved: Requirement[] = [];

    inputs.forEach((record) => {
      const existing = getRequirementByExternalId(projectId, record.externalId);
      const id = existing?.id ?? createId("req");
      const createdAt = existing?.createdAt ?? nowIso();
      const updatedAt = nowIso();

      getDb()
        .prepare(
          `INSERT INTO requirements (
            id, project_id, external_id, title, text, source, type, status, priority,
            verification_method, parent_external_id, raw_attributes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, external_id) DO UPDATE SET
            title = excluded.title,
            text = excluded.text,
            source = excluded.source,
            type = excluded.type,
            status = excluded.status,
            priority = excluded.priority,
            verification_method = excluded.verification_method,
            parent_external_id = excluded.parent_external_id,
            raw_attributes = excluded.raw_attributes,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          projectId,
          record.externalId,
          record.title,
          record.text,
          record.source,
          record.type ?? null,
          record.status ?? null,
          record.priority ?? null,
          record.verificationMethod ?? null,
          record.parentExternalId ?? null,
          safeJsonStringify(record.rawAttributes),
          createdAt,
          updatedAt
        );

      const savedRecord = getRequirementByExternalId(projectId, record.externalId);
      if (savedRecord) {
        saved.push(savedRecord);
      }
    });

    touchProject(projectId);
    return saved;
  })(records);

export const saveWorkItems = (projectId: string, records: WorkItemInput[]): WorkItem[] =>
  getDb().transaction((inputs: WorkItemInput[]) => {
    const saved: WorkItem[] = [];

    inputs.forEach((record) => {
      const existing = getWorkItemByExternalId(projectId, record.externalId);
      const id = existing?.id ?? createId("work");
      const createdAt = existing?.createdAt ?? nowIso();
      const updatedAt = nowIso();

      getDb()
        .prepare(
          `INSERT INTO work_items (
            id, project_id, external_id, title, description, status, type, assignee,
            source, raw_attributes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, external_id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            type = excluded.type,
            assignee = excluded.assignee,
            source = excluded.source,
            raw_attributes = excluded.raw_attributes,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          projectId,
          record.externalId,
          record.title,
          record.description ?? null,
          record.status ?? null,
          record.type ?? null,
          record.assignee ?? null,
          record.source,
          safeJsonStringify(record.rawAttributes),
          createdAt,
          updatedAt
        );

      const savedRecord = getWorkItemByExternalId(projectId, record.externalId);
      if (savedRecord) {
        saved.push(savedRecord);
      }
    });

    touchProject(projectId);
    return saved;
  })(records);

export const saveTestCases = (projectId: string, records: TestCaseInput[]): TestCase[] =>
  getDb().transaction((inputs: TestCaseInput[]) => {
    const saved: TestCase[] = [];

    inputs.forEach((record) => {
      const existing = getTestCaseByExternalId(projectId, record.externalId);
      const id = existing?.id ?? createId("test");
      const createdAt = existing?.createdAt ?? nowIso();
      const updatedAt = nowIso();

      getDb()
        .prepare(
          `INSERT INTO test_cases (
            id, project_id, external_id, name, classname, status, duration, failure_message,
            source, raw_attributes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, external_id) DO UPDATE SET
            name = excluded.name,
            classname = excluded.classname,
            status = excluded.status,
            duration = excluded.duration,
            failure_message = excluded.failure_message,
            source = excluded.source,
            raw_attributes = excluded.raw_attributes,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          projectId,
          record.externalId,
          record.name,
          record.classname ?? null,
          record.status,
          record.duration ?? null,
          record.failureMessage ?? null,
          record.source,
          safeJsonStringify(record.rawAttributes),
          createdAt,
          updatedAt
        );

      const savedRecord = getTestCaseByExternalId(projectId, record.externalId);
      if (savedRecord) {
        saved.push(savedRecord);
      }
    });

    touchProject(projectId);
    return saved;
  })(records);

export function saveTraceLink(projectId: string, input: TraceLinkInput): TraceLink {
  const existing = getDb()
    .prepare(
      `SELECT * FROM trace_links
      WHERE project_id = ? AND source_type = ? AND source_id = ? AND target_type = ?
      AND target_id = ? AND link_type = ?`
    )
    .get(projectId, input.sourceType, input.sourceId, input.targetType, input.targetId, input.linkType) as
    | TraceLinkRow
    | undefined;
  const now = nowIso();
  const id = existing?.id ?? createId("trace");

  getDb()
    .prepare(
      `INSERT INTO trace_links (
        id, project_id, source_type, source_id, target_type, target_id, link_type,
        confidence, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, source_type, source_id, target_type, target_id, link_type) DO UPDATE SET
        confidence = excluded.confidence,
        source = excluded.source,
        updated_at = excluded.updated_at`
    )
    .run(
      id,
      projectId,
      input.sourceType,
      input.sourceId,
      input.targetType,
      input.targetId,
      input.linkType,
      input.confidence,
      input.source,
      existing?.created_at ?? now,
      now
    );

  const row = getDb()
    .prepare("SELECT * FROM trace_links WHERE id = ?")
    .get(id) as TraceLinkRow;
  return traceLinkFromRow(row);
}

export function replaceFindings(projectId: string, findings: FindingInput[]): Finding[] {
  return getDb().transaction((inputs: FindingInput[]) => {
    getDb().prepare("DELETE FROM findings WHERE project_id = ?").run(projectId);
    const now = nowIso();

    inputs.forEach((finding) => {
      getDb()
        .prepare(
          `INSERT INTO findings (
            id, project_id, severity, category, title, description, entity_type,
            entity_id, recommendation, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          createId("finding"),
          projectId,
          finding.severity,
          finding.category,
          finding.title,
          finding.description,
          finding.entityType,
          finding.entityId,
          finding.recommendation ?? null,
          now,
          now
        );
    });

    touchProject(projectId);
    return getFindings(projectId);
  })(findings);
}

export function addImportBatch(
  projectId: string,
  sourceType: string,
  filename: string,
  recordCount: number,
  errors: string[]
): ImportBatch {
  const importedAt = nowIso();
  const id = createId("import");

  getDb()
    .prepare(
      `INSERT INTO import_batches (
        id, project_id, source_type, filename, imported_at, record_count, errors
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, projectId, sourceType, filename, importedAt, recordCount, JSON.stringify(errors));

  touchProject(projectId);

  const row = getDb()
    .prepare("SELECT * FROM import_batches WHERE id = ?")
    .get(id) as ImportBatchRow;
  return importBatchFromRow(row);
}

export function getProjectSummary(projectId: string): ProjectSummary | null {
  const data = getProjectData(projectId);
  if (!data) {
    return null;
  }

  const requirementWorkCounts = new Map(data.requirements.map((requirement) => [requirement.id, 0]));
  const requirementTestCounts = new Map(data.requirements.map((requirement) => [requirement.id, 0]));
  const failedTests = new Set(data.testCases.filter((test) => test.status === "failed").map((test) => test.id));
  let failedTestsLinkedToRequirements = 0;

  data.traceLinks.forEach((link) => {
    if (link.sourceType === "requirement" && link.targetType === "workItem") {
      requirementWorkCounts.set(link.sourceId, (requirementWorkCounts.get(link.sourceId) ?? 0) + 1);
    }

    if (link.targetType === "requirement" && link.sourceType === "workItem") {
      requirementWorkCounts.set(link.targetId, (requirementWorkCounts.get(link.targetId) ?? 0) + 1);
    }

    if (link.sourceType === "requirement" && link.targetType === "testCase") {
      requirementTestCounts.set(link.sourceId, (requirementTestCounts.get(link.sourceId) ?? 0) + 1);
      if (failedTests.has(link.targetId)) {
        failedTestsLinkedToRequirements += 1;
      }
    }

    if (link.targetType === "requirement" && link.sourceType === "testCase") {
      requirementTestCounts.set(link.targetId, (requirementTestCounts.get(link.targetId) ?? 0) + 1);
      if (failedTests.has(link.sourceId)) {
        failedTestsLinkedToRequirements += 1;
      }
    }
  });

  return {
    totalRequirements: data.requirements.length,
    totalWorkItems: data.workItems.length,
    totalTests: data.testCases.length,
    totalTraceLinks: data.traceLinks.length,
    totalFindings: data.findings.length,
    requirementsWithoutWork: Array.from(requirementWorkCounts.values()).filter((count) => count === 0).length,
    requirementsWithoutTests: Array.from(requirementTestCounts.values()).filter((count) => count === 0).length,
    weakRequirements: data.findings.filter((finding) => finding.category === "weak_wording").length,
    failedTestsLinkedToRequirements
  };
}
