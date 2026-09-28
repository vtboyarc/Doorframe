import { describe, expect, it } from "vitest";
import { importBlockedReason, readFileCopy, requestJson, type ImportFormState } from "./import-client";
import { SERVER_UNREACHABLE_MESSAGE } from "./import-messages";

const init: RequestInit = { method: "POST" };

describe("requestJson", () => {
  it("returns the JSON body of a successful response", async () => {
    const outcome = await requestJson<{ recordCount: number }>("/x", init, async () =>
      Response.json({ recordCount: 3 })
    );
    expect(outcome).toEqual({ ok: true, data: { recordCount: 3 } });
  });

  it("turns a network failure into a server-unreachable message", async () => {
    const outcome = await requestJson("/x", init, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(outcome).toEqual({ ok: false, failure: { message: SERVER_UNREACHABLE_MESSAGE } });
  });

  it("uses the error body of a failed response", async () => {
    const outcome = await requestJson("/x", init, async () =>
      Response.json({ error: "Choose a file to import.", detail: "raw" }, { status: 400 })
    );
    expect(outcome).toEqual({ ok: false, failure: { message: "Choose a file to import.", detail: "raw" } });
  });

  it("explains a response that is not JSON", async () => {
    const outcome = await requestJson("/x", init, async () => new Response("<html>Internal error</html>", { status: 500 }));
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.failure.message).toMatch(/unexpected response \(HTTP 500\)/);

    const tooLarge = await requestJson("/x", init, async () => new Response("Payload Too Large", { status: 413 }));
    expect(!tooLarge.ok && tooLarge.failure.message).toMatch(/up to 25\.0 MB/);
  });
});

describe("readFileCopy", () => {
  it("copies a readable file", async () => {
    const copy = await readFileCopy(new File(["ID,Text\n"], "a.csv", { type: "text/csv" }));
    expect(await copy?.text()).toBe("ID,Text\n");
    expect(copy?.type).toBe("text/csv");
  });

  it("returns null when the file can no longer be read", async () => {
    const changed = {
      type: "text/csv",
      arrayBuffer: () => Promise.reject(new DOMException("The file changed.", "NotReadableError"))
    } as unknown as Blob;
    expect(await readFileCopy(changed)).toBeNull();
  });
});

describe("importBlockedReason", () => {
  const ready: ImportFormState = {
    file: { size: 100 },
    tooLarge: false,
    isCsv: true,
    preview: { status: "ready", preview: { headers: ["ID", "Text"], rows: [], totalRows: 1, mapping: {} } },
    check: { missingRequired: [], sharedColumns: [], canImport: true }
  };

  it("allows an import once the file is read and mapped", () => {
    expect(importBlockedReason(ready)).toBeNull();
    expect(importBlockedReason({ ...ready, jiraUnconfirmed: false })).toBeNull();
  });

  it("blocks a Jira-shaped Requirements CSV until the user switches type or confirms", () => {
    const jira = { ...ready, jiraUnconfirmed: true, check: { ...ready.check, missingRequired: ["Requirement ID"], canImport: false } };

    expect(importBlockedReason(jira)).toBe("Switch to Jira CSV, or confirm that this file holds requirements.");
    expect(importBlockedReason({ ...jira, jiraUnconfirmed: false })).toBe("Map Requirement ID to continue.");
  });

  it("explains the other blocked states", () => {
    expect(importBlockedReason({ ...ready, file: null })).toBe("Choose a file to import.");
    expect(importBlockedReason({ ...ready, tooLarge: true })).toBe("This file is too large to import here.");
    expect(importBlockedReason({ ...ready, preview: { status: "loading" } })).toBe("Reading the file…");
    expect(importBlockedReason({ ...ready, preview: { status: "error", failure: { message: "x" } } })).toMatch(
      /Fix the problem/
    );
    expect(importBlockedReason({ ...ready, isCsv: false, preview: { status: "idle" } })).toBeNull();
    expect(
      importBlockedReason({
        ...ready,
        check: { missingRequired: [], sharedColumns: [{ column: "ID", fields: ["Requirement ID", "Text"], includesRequired: true }], canImport: false }
      })
    ).toBe("Required fields need their own column.");
  });
});
