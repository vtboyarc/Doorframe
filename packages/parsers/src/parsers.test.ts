import { describe, expect, it } from "vitest";
import { parseRequirementsCsv, parseJiraCsv } from "./csv";
import { extractRequirementIds } from "./ids";
import { parseJUnitXml } from "./junit";

describe("extractRequirementIds", () => {
  it("normalizes common requirement id patterns", () => {
    expect(extractRequirementIds("REQ-123, sys123, shall 44, doors_77")).toEqual([
      "REQ-123",
      "SYS-123",
      "DOORS-77",
      "SHALL-44"
    ]);
  });
});

describe("parseRequirementsCsv", () => {
  it("maps requirement rows", () => {
    const result = parseRequirementsCsv(
      "ID,Title,Text,Verification\nREQ-1,Login,The system shall authenticate users.,Test\n",
      {
        requirementId: "ID",
        title: "Title",
        text: "Text",
        verificationMethod: "Verification"
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({
      externalId: "REQ-1",
      title: "Login",
      verificationMethod: "Test"
    });
  });
});

describe("parseJiraCsv", () => {
  it("detects requirement ids from Jira text", () => {
    const result = parseJiraCsv(
      "Key,Summary,Description,Status\nENG-1,Implement login,Implements REQ-1 and SYS-2,Done\n",
      {
        issueKey: "Key",
        summary: "Summary",
        description: "Description",
        status: "Status"
      }
    );

    expect(result.records[0]?.requirementIds).toEqual(["REQ-1", "SYS-2"]);
  });
});

describe("parseJUnitXml", () => {
  it("parses pass and fail test cases with requirement ids", () => {
    const xml = `<testsuite name="doorframe">
      <testcase classname="LoginTests" name="REQ-1 authenticates user" time="0.02" />
      <testcase classname="LoginTests" name="REQ-2 rejects bad password" time="0.01">
        <failure message="Expected rejection" />
      </testcase>
    </testsuite>`;

    const result = parseJUnitXml(xml);

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.status).toBe("passed");
    expect(result.records[1]?.status).toBe("failed");
    expect(result.records[1]?.requirementIds).toEqual(["REQ-2"]);
  });
});
