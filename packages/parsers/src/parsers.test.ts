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

  it("detects requirement ids embedded in test names", () => {
    expect(extractRequirementIds("TelemetryStatusPanelTests.testDisplaysStatusWithinTwoSeconds_REQ_001")).toEqual([
      "REQ-001"
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

  it("infers ugly headers, trims whitespace, and warns on duplicate ids", () => {
    const result = parseRequirementsCsv(
      "Requirement ID,Name,Description,Verified By\n REQ_1 ,Login,The system shall log in users.,Test\nREQ-1,Duplicate,Duplicate row,Test\n",
      {}
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalId: "REQ-1",
      title: "Login",
      verificationMethod: "Test"
    });
    expect(result.errors.join("\n")).toContain("duplicate requirement ID REQ-1");
  });

  it("returns a helpful error when required columns are missing", () => {
    const result = parseRequirementsCsv("Name,Description\nLogin,The system shall log in users.\n", {});

    expect(result.records).toEqual([]);
    expect(result.errors.join("\n")).toContain("Missing required requirements CSV column for requirement ID");
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

  it("extracts requirement ids from common Jira custom fields and labels", () => {
    const result = parseJiraCsv(
      "Issue key,Summary,Description,Status,Issue Type,Labels,Custom field (Requirement IDs)\nFG-1,Work item,No id here,Done,Story,trace-REQ-7,REQ-8\n",
      {}
    );

    expect(result.records[0]?.requirementIds).toEqual(["REQ-8", "REQ-7"]);
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

  it("parses skipped and errored JUnit cases", () => {
    const xml = `<testsuite name="doorframe">
      <testcase classname="ImportTests" name="REQ-3 skipped" time="0.02">
        <skipped message="not ready" />
      </testcase>
      <testcase classname="ImportTests" name="REQ-4 errored" time="0.01">
        <error message="runner error" />
      </testcase>
    </testsuite>`;

    const result = parseJUnitXml(xml);

    expect(result.records.map((record) => record.status)).toEqual(["skipped", "errored"]);
    expect(result.records[1]?.failureMessage).toBe("runner error");
  });
});
