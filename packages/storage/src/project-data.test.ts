import { describe, expect, it } from "vitest";
import { buildProjectDataFromImportedRecords } from "./project-data";

describe("buildProjectDataFromImportedRecords", () => {
  it("deduplicates repeated references while preserving distinct work, test, and parent traces", () => {
    const data = buildProjectDataFromImportedRecords({
      projectName: "Fictional gateway",
      requirements: [
        { externalId: "REQ-1", title: "Gateway", text: "The gateway shall display status within 1 second.", source: "csv" },
        { externalId: "REQ-2", title: "Panel", text: "The panel shall show errors within 2 seconds.", source: "csv", parentExternalId: "REQ-1" }
      ],
      workItems: [
        { externalId: "WORK-1", title: "Display status", source: "csv", requirementIds: ["REQ-1", "REQ-1", "REQ-2", "MISSING"] },
        { externalId: "WORK-2", title: "Show errors", source: "csv", requirementIds: ["REQ-2"] }
      ],
      testCases: [
        { externalId: "gateway.status", name: "Display status", status: "passed", source: "junit", requirementIds: ["REQ-1", "REQ-1", "REQ-2", "MISSING"] },
        { externalId: "gateway.errors", name: "Show errors", status: "failed", source: "junit", requirementIds: ["REQ-2"] }
      ]
    });
    const externalIds = new Map(
      [...data.requirements, ...data.workItems, ...data.testCases].map((record) => [record.id, record.externalId])
    );
    const links = data.traceLinks.map((link) => [
      externalIds.get(link.sourceId), externalIds.get(link.targetId), link.linkType, link.confidence
    ]);

    expect(links).toEqual([
      ["REQ-1", "REQ-2", "parent", 0.95],
      ["REQ-1", "WORK-1", "implements", 0.85],
      ["REQ-2", "WORK-1", "implements", 0.85],
      ["REQ-2", "WORK-2", "implements", 0.85],
      ["REQ-1", "gateway.status", "verifies", 0.8],
      ["REQ-2", "gateway.status", "verifies", 0.8],
      ["REQ-2", "gateway.errors", "verifies", 0.8]
    ]);
    expect(data.findings.filter((finding) => finding.title.includes("no linked"))).toEqual([]);
  });
});
