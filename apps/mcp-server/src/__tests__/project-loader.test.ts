import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectDataFromSqlite, ReadOnlyProjectLoadError } from "@doorframe/storage";
import { loadProjectDb } from "../project-loader";
import { createDemoProjectDb } from "./fixtures";

function tempSqlitePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-empty-"));
  return path.join(dir, name);
}

describe("Doorframe MCP project loader", () => {
  it("requires an explicit project database path", () => {
    expect(() => loadProjectDb(undefined)).toThrow(ReadOnlyProjectLoadError);

    try {
      loadProjectDb(undefined);
    } catch (error) {
      expect(error).toBeInstanceOf(ReadOnlyProjectLoadError);
      expect((error as ReadOnlyProjectLoadError).code).toBe("MISSING_PROJECT_PATH");
      expect((error as Error).message).toContain("doorframe-mcp --project");
    }
  });

  it("returns a clear error for a missing database file", () => {
    const missingPath = path.join(os.tmpdir(), "does-not-exist-doorframe.sqlite");

    expect(() => loadProjectDb(missingPath)).toThrow(ReadOnlyProjectLoadError);
  });

  it("returns a clear error for an empty Doorframe database", () => {
    const dbPath = tempSqlitePath("empty.sqlite");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.close();

    try {
      loadProjectDataFromSqlite(dbPath);
    } catch (error) {
      expect(error).toBeInstanceOf(ReadOnlyProjectLoadError);
      expect((error as ReadOnlyProjectLoadError).code).toBe("EMPTY_PROJECT");
      expect((error as Error).message).toContain("appears empty");
      return;
    }

    throw new Error("expected empty project error");
  });

  it("loads the newest Doorframe project data read-only", () => {
    const dbPath = createDemoProjectDb();
    const projectDb = loadProjectDb(dbPath);
    const data = projectDb.loadProjectData();

    expect(data.project.name).toBe("Demo Doorframe Project");
    expect(data.requirements.map((requirement) => requirement.externalId)).toEqual(["REQ-001", "REQ-002", "REQ-003"]);
    expect(data.findings).toHaveLength(4);
  });

  it("loads the explicitly selected project from a multi-project database", () => {
    const dbPath = createDemoProjectDb();
    const db = new Database(dbPath);
    db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run(
      "project_2",
      "Newer Project",
      "2026-02-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z"
    );
    db.close();

    const newestProjectDb = loadProjectDb(dbPath);
    const selectedProjectDb = loadProjectDb(dbPath, "project_1");
    const newestProject = newestProjectDb.loadProjectData();
    const selectedProject = selectedProjectDb.loadProjectData();

    expect(newestProject.project.name).toBe("Newer Project");
    expect(newestProjectDb.listBaselines()).toHaveLength(0);
    expect(selectedProject.project.name).toBe("Demo Doorframe Project");
    expect(selectedProject.requirements).toHaveLength(3);
    expect(selectedProjectDb.listBaselines()).toHaveLength(2);
  });

  it("fails clearly when the selected project does not exist", () => {
    const dbPath = createDemoProjectDb();

    try {
      loadProjectDb(dbPath, "project_missing");
    } catch (error) {
      expect(error).toBeInstanceOf(ReadOnlyProjectLoadError);
      expect((error as ReadOnlyProjectLoadError).code).toBe("PROJECT_NOT_FOUND");
      expect((error as Error).message).toContain("project_missing");
      expect((error as Error).message).toContain("re-copy the MCP config");
      return;
    }

    throw new Error("expected missing selected project error");
  });
});
