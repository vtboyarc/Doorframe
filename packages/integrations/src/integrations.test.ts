import { describe, expect, it } from "vitest";
import type { HttpClient, HttpResponse } from "./http";
import { fetchJiraIssues } from "./jira";
import { fetchJenkinsTestReport } from "./jenkins";
import { fetchGithubJunit } from "./github";
import { fetchGitlabJunit } from "./gitlab";

function jsonResponse(body: unknown, status = 200): HttpResponse {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) };
}

function textResponse(body: string, status = 200): HttpResponse {
  return { status, ok: status >= 200 && status < 300, text: async () => body };
}

const JUNIT = `<testsuites><testsuite name="S"><testcase classname="C" name="checks_REQ_001" time="0.1" /></testsuite></testsuites>`;

describe("fetchJiraIssues", () => {
  it("maps issues to work items and extracts requirement ids", async () => {
    const http: HttpClient = async () =>
      jsonResponse({
        issues: [
          {
            key: "FG-1",
            fields: {
              summary: "Implement REQ-001",
              description: "Covers REQ-002 too",
              status: { name: "Done" },
              issuetype: { name: "Story" },
              assignee: { displayName: "Avery" }
            }
          }
        ]
      });

    const result = await fetchJiraIssues(
      { baseUrl: "https://x.atlassian.net", email: "a@b.c", apiToken: "t", jql: "project=FG" },
      http
    );

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].externalId).toBe("FG-1");
    expect(result.records[0].requirementIds).toEqual(expect.arrayContaining(["REQ-001", "REQ-002"]));
  });

  it("reports an error on failure", async () => {
    const http: HttpClient = async () => textResponse("nope", 401);
    const result = await fetchJiraIssues(
      { baseUrl: "https://x", email: "a", apiToken: "t", jql: "" },
      http
    );
    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toContain("401");
  });
});

describe("fetchJenkinsTestReport", () => {
  it("maps suites and cases to test cases", async () => {
    const http: HttpClient = async () =>
      jsonResponse({
        suites: [
          {
            cases: [
              { className: "C", name: "verifies_REQ_001", status: "PASSED", duration: 0.2 },
              { className: "C", name: "broken_REQ_002", status: "FAILED", errorDetails: "boom" }
            ]
          }
        ]
      });

    const result = await fetchJenkinsTestReport({ baseUrl: "https://ci", job: "app", build: 5 }, http);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].status).toBe("passed");
    expect(result.records[1].status).toBe("failed");
    expect(result.records[0].requirementIds).toContain("REQ-001");
  });
});

describe("fetchGithubJunit", () => {
  it("parses provided JUnit XML directly", async () => {
    const result = await fetchGithubJunit({ owner: "o", repo: "r", token: "t", junitXml: JUNIT });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].requirementIds).toContain("REQ-001");
  });
});

describe("fetchGitlabJunit", () => {
  it("fetches and parses a junit artifact", async () => {
    const http: HttpClient = async () => textResponse(JUNIT);
    const result = await fetchGitlabJunit({ projectId: 1, jobId: 2, token: "t" }, http);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].requirementIds).toContain("REQ-001");
  });
});
