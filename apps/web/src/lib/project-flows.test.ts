import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as create } from "../app/api/projects/route";
import { DELETE as remove } from "../app/api/projects/[projectId]/route";
import { POST as preview } from "../app/api/projects/[projectId]/import/preview/route";
import { POST as upload } from "../app/api/projects/[projectId]/import/route";
import { createBaseline, getDb, getProjectData } from "./db";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-project-flows-"));
const sample = fs.readFileSync(path.resolve(__dirname, "../../../../examples/sample-requirements.csv"));
let opened = false;
const oldDataDir = process.env.DOORFRAME_DATA_DIR;

beforeAll(() => {
  process.env.DOORFRAME_DATA_DIR = dataDir;
  getDb();
  opened = true;
});

afterAll(() => {
  if (opened) getDb().close();
  if (oldDataDir === undefined) delete process.env.DOORFRAME_DATA_DIR;
  else process.env.DOORFRAME_DATA_DIR = oldDataDir;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function freshProject(name: string) {
  const response = await create(new Request("http://localhost/api/projects", {
    method: "POST", body: JSON.stringify({ name })
  }));
  expect(response.status).toBe(201);
  return (await response.json()).project.id as string;
}

function csvRequest(contents: string | Uint8Array = sample, mapping?: Record<string, string>) {
  const form = new FormData();
  const bytes = typeof contents === "string" ? new TextEncoder().encode(contents) : new Uint8Array(contents);
  form.set("sourceType", "requirements-csv");
  form.set("file", new File([bytes], "sample-requirements.csv", { type: "text/csv" }));
  if (mapping) form.set("mapping", JSON.stringify(mapping));
  return new Request("http://localhost/api/projects/test/import", { method: "POST", body: form });
}

describe("fresh project HTTP handlers with disposable SQLite data", () => {
  it("previews and imports sample-requirements.csv after a rejected file (#35)", async () => {
    const projectId = await freshProject("Fictional CSV review");
    const context = { params: Promise.resolve({ projectId }) };
    const invalid = await preview(csvRequest(""), context);
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toHaveProperty("error");
    expect(getProjectData(projectId)?.requirements).toHaveLength(0);

    const response = await preview(csvRequest(), context);
    expect(response.status).toBe(200);
    const shape = await response.json();
    expect(shape.totalRows).toBe(5);
    const imported = await upload(csvRequest(sample, shape.mapping), context);
    expect(imported.status).toBe(200);
    expect(await imported.json()).toMatchObject({ status: "imported", recordCount: 5, createdCount: 5, errors: [] });
    expect(getProjectData(projectId)?.requirements.map((item) => item.externalId).sort())
      .toEqual(["REQ-001", "REQ-002", "REQ-003", "REQ-004", "REQ-005"]);
  });

  it("deletes a populated project and its related data while preserving another project (#34)", async () => {
    const projectId = await freshProject("Disposable deletion review");
    const survivorId = await freshProject("Keep this fictional project");
    const context = { params: Promise.resolve({ projectId }) };
    expect((await upload(csvRequest(), context)).status).toBe(200);
    expect(createBaseline(projectId, "Before deletion")).not.toBeNull();
    expect(getProjectData(projectId)?.findings.length).toBeGreaterThan(0);

    const response = await remove(new Request("http://localhost", { method: "DELETE" }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(getProjectData(projectId)).toBeNull();
    expect(getProjectData(survivorId)?.project.name).toBe("Keep this fictional project");
    for (const table of ["requirements", "work_items", "test_cases", "trace_links", "findings", "import_batches", "rulesets", "baselines", "audit_log", "trace_references"]) {
      expect(getDb().prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE project_id = ?`).get(projectId))
        .toEqual({ count: 0 });
    }
    expect((await remove(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(404);
  });
});
