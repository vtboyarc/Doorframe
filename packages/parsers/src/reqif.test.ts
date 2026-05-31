import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseReqif } from "./reqif";

const examplesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../examples");

describe("parseReqif (type-aware)", () => {
  it("maps named attributes and spec hierarchy to requirement fields", () => {
    const xml = readFileSync(path.join(examplesDir, "sample.reqif"), "utf8");
    const result = parseReqif(xml);

    expect(result.errors).toHaveLength(0);
    const byId = new Map(result.records.map((r) => [r.externalId, r]));

    const req6 = byId.get("REQ-006");
    expect(req6?.text).toContain("reject telemetry packets");
    expect(req6?.priority).toBe("High");
    expect(req6?.verificationMethod).toBe("Test");
    expect(req6?.status).toBe("Approved");

    const req7 = byId.get("REQ-007");
    expect(req7?.status).toBe("Draft");
    // REQ-007 is nested under REQ-006 in the spec hierarchy.
    expect(req7?.parentExternalId).toBe("REQ-006");
  });

  it("falls back to longest VALUES text when no named text attribute exists", () => {
    const xml = `<?xml version="1.0"?><REQ-IF><CORE-CONTENT><REQ-IF-CONTENT><SPEC-OBJECTS>
      <SPEC-OBJECT IDENTIFIER="REQ-100" LONG-NAME="Simple">
        <VALUES><ATTRIBUTE-VALUE-STRING THE-VALUE="The system shall remain simple." /></VALUES>
      </SPEC-OBJECT>
    </SPEC-OBJECTS></REQ-IF-CONTENT></CORE-CONTENT></REQ-IF>`;
    const result = parseReqif(xml);
    expect(result.records[0].externalId).toBe("REQ-100");
    expect(result.records[0].text).toContain("remain simple");
  });
});
