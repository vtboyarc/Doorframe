import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createDemoProjectDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-test-"));
  const dbPath = path.join(dir, "doorframe.sqlite");
  const db = new Database(dbPath);
  const now = "2026-01-01T00:00:00.000Z";

  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE requirements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
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
      updated_at TEXT NOT NULL
    );

    CREATE TABLE work_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT,
      type TEXT,
      assignee TEXT,
      source TEXT NOT NULL,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE test_cases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      classname TEXT,
      status TEXT NOT NULL,
      duration REAL,
      failure_message TEXT,
      source TEXT NOT NULL,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE trace_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
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

    CREATE TABLE import_batches (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      errors TEXT
    );
  `);

  const insertProject = db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)");
  insertProject.run("project_1", "Demo Doorframe Project", now, now);

  const insertRequirement = db.prepare(
    `INSERT INTO requirements (
      id, project_id, external_id, title, text, source, type, status, priority,
      verification_method, parent_external_id, raw_attributes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertRequirement.run(
    "req_1",
    "project_1",
    "REQ-001",
    "Authenticate users",
    "The system shall authenticate users within 2 seconds.",
    "requirements-csv",
    "functional",
    "approved",
    "high",
    "test",
    null,
    "{}",
    now,
    now
  );
  insertRequirement.run(
    "req_2",
    "project_1",
    "REQ-002",
    "Record audit trail",
    "The system shall provide appropriate logging.",
    "requirements-csv",
    "functional",
    "changed",
    "medium",
    null,
    null,
    "{}",
    now,
    now
  );
  insertRequirement.run(
    "req_3",
    "project_1",
    "REQ-003",
    "Export reports",
    "The system shall export CSV and shall export JSON.",
    "requirements-csv",
    "functional",
    "approved",
    "medium",
    "test",
    null,
    "{}",
    now,
    now
  );

  const insertWork = db.prepare(
    `INSERT INTO work_items (
      id, project_id, external_id, title, description, status, type, assignee,
      source, raw_attributes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertWork.run("work_1", "project_1", "DOOR-1", "Implement authentication", "", "done", "story", "Ava", "jira-csv", "{}", now, now);
  insertWork.run("work_2", "project_1", "DOOR-2", "Implement export", "", "closed", "story", "Noah", "jira-csv", "{}", now, now);
  insertWork.run("work_3", "project_1", "DOOR-3", "Unlinked cleanup", "", "open", "task", "Ava", "jira-csv", "{}", now, now);

  const insertTest = db.prepare(
    `INSERT INTO test_cases (
      id, project_id, external_id, name, classname, status, duration, failure_message,
      source, raw_attributes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertTest.run("test_1", "project_1", "TC-001", "auth passes", "AuthTest", "passed", 0.1, null, "junit-xml", "{}", now, now);
  insertTest.run("test_2", "project_1", "TC-002", "export fails", "ExportTest", "failed", 0.2, "expected CSV", "junit-xml", "{}", now, now);
  insertTest.run("test_3", "project_1", "TC-003", "unlinked skipped", "OtherTest", "skipped", 0.2, null, "junit-xml", "{}", now, now);

  const insertTrace = db.prepare(
    `INSERT INTO trace_links (
      id, project_id, source_type, source_id, target_type, target_id, link_type,
      confidence, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertTrace.run("trace_1", "project_1", "requirement", "req_1", "workItem", "work_1", "implements", 0.9, "jira-csv", now, now);
  insertTrace.run("trace_2", "project_1", "requirement", "req_1", "testCase", "test_1", "verifies", 0.9, "junit-xml", now, now);
  insertTrace.run("trace_3", "project_1", "requirement", "req_3", "workItem", "work_2", "implements", 0.9, "jira-csv", now, now);
  insertTrace.run("trace_4", "project_1", "requirement", "req_3", "testCase", "test_2", "verifies", 0.9, "junit-xml", now, now);

  const insertFinding = db.prepare(
    `INSERT INTO findings (
      id, project_id, severity, category, title, description, entity_type,
      entity_id, recommendation, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertFinding.run(
    "finding_1",
    "project_1",
    "error",
    "missing_verification",
    "REQ-002 has no linked test case",
    "No JUnit test case is linked to this requirement.",
    "requirement",
    "req_2",
    "Link passing test evidence.",
    now,
    now
  );
  insertFinding.run(
    "finding_2",
    "project_1",
    "warning",
    "missing_work_trace",
    "REQ-002 has no linked work item",
    "No Jira or work item trace was found for this requirement.",
    "requirement",
    "req_2",
    "Map a work item.",
    now,
    now
  );
  insertFinding.run(
    "finding_3",
    "project_1",
    "warning",
    "weak_wording",
    "REQ-002 uses vague language",
    "The requirement contains vague wording: appropriate.",
    "requirement",
    "req_2",
    "Replace vague wording.",
    now,
    now
  );
  insertFinding.run(
    "finding_4",
    "project_1",
    "error",
    "closed_work_without_verification",
    "DOOR-2 is closed without passing verification",
    "Closed work is linked to requirements without passing test evidence: REQ-003.",
    "workItem",
    "work_2",
    "Link passing JUnit evidence.",
    now,
    now
  );

  db.prepare("INSERT INTO import_batches VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "import_1",
    "project_1",
    "requirements-csv",
    "requirements.csv",
    now,
    3,
    "[]"
  );

  db.close();
  return dbPath;
}
