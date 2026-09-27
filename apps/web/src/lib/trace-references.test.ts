import { describe, expect, it } from "vitest";
import {
  buildTraceReferences,
  planLinkSync,
  planParentLinks,
  planReferenceLinks,
  traceLinkKey,
  type TraceReference
} from "./trace-references";

const requirements = new Map([
  ["REQ-001", "req-1"],
  ["REQ-002", "req-2"]
]);

describe("buildTraceReferences", () => {
  it("stores one reference per entity and requirement with the link rule for the entity type", () => {
    const references = buildTraceReferences(
      "workItem",
      [
        { externalId: "FG-1", requirementIds: ["REQ-001", "REQ-009", "REQ-001"] },
        { externalId: "FG-2", requirementIds: [] }
      ],
      "jira-csv"
    );

    expect(references).toEqual([
      {
        entityType: "workItem",
        entityExternalId: "FG-1",
        requirementExternalId: "REQ-001",
        linkType: "implements",
        confidence: 0.85,
        source: "jira-csv"
      },
      {
        entityType: "workItem",
        entityExternalId: "FG-1",
        requirementExternalId: "REQ-009",
        linkType: "implements",
        confidence: 0.85,
        source: "jira-csv"
      }
    ]);
  });

  it("uses verifies links for test cases", () => {
    const [reference] = buildTraceReferences("testCase", [{ externalId: "Suite.test", requirementIds: ["REQ-001"] }], "junit-xml");
    expect(reference.linkType).toBe("verifies");
  });
});

describe("planLinkSync", () => {
  it("creates links only to requirements that exist", () => {
    const plan = planLinkSync({
      entityType: "workItem",
      source: "jira-csv",
      entities: [{ entityId: "work-1", requirementExternalIds: ["REQ-001", "REQ-404"] }],
      requirementIdByExternalId: requirements,
      existingLinks: []
    });

    expect(plan.deleteLinkIds).toEqual([]);
    expect(plan.create).toEqual([
      {
        sourceType: "requirement",
        sourceId: "req-1",
        targetType: "workItem",
        targetId: "work-1",
        linkType: "implements",
        confidence: 0.85,
        source: "jira-csv"
      }
    ]);
  });

  it("deletes links the entity no longer mentions and keeps the ones it still does", () => {
    const plan = planLinkSync({
      entityType: "testCase",
      source: "junit-xml",
      entities: [{ entityId: "test-1", requirementExternalIds: ["REQ-002"] }],
      requirementIdByExternalId: requirements,
      existingLinks: [
        { linkId: "link-a", requirementId: "req-1", entityId: "test-1" },
        { linkId: "link-b", requirementId: "req-2", entityId: "test-1" },
        { linkId: "link-c", requirementId: "req-1", entityId: "test-other" }
      ]
    });

    expect(plan.deleteLinkIds).toEqual(["link-a"]);
    expect(plan.create).toEqual([]);
  });
});

describe("planReferenceLinks", () => {
  const reference = (entityType: TraceReference["entityType"], entityExternalId: string, requirementExternalId: string) =>
    buildTraceReferences(entityType, [{ externalId: entityExternalId, requirementIds: [requirementExternalId] }], "test")[0];

  it("links stored references once both ends exist and skips existing links", () => {
    const existing = {
      sourceType: "requirement",
      sourceId: "req-2",
      targetType: "testCase",
      targetId: "test-1",
      linkType: "verifies"
    };
    const links = planReferenceLinks({
      references: [
        reference("workItem", "FG-1", "REQ-001"),
        reference("workItem", "FG-1", "REQ-001"),
        reference("workItem", "FG-missing", "REQ-001"),
        reference("testCase", "Suite.a", "REQ-404"),
        reference("testCase", "Suite.a", "REQ-002")
      ],
      requirementIdByExternalId: requirements,
      entityIdByExternalId: {
        workItem: new Map([["FG-1", "work-1"]]),
        testCase: new Map([["Suite.a", "test-1"]])
      },
      existingLinkKeys: new Set([traceLinkKey(existing)])
    });

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ sourceId: "req-1", targetType: "workItem", targetId: "work-1", linkType: "implements" });
  });
});

describe("planParentLinks", () => {
  it("links children to parents that exist, including parents imported later", () => {
    const links = planParentLinks({
      requirements: [
        { id: "req-2", parentExternalId: "REQ-001", source: "requirements-csv" },
        { id: "req-3", parentExternalId: "REQ-404", source: "requirements-csv" },
        { id: "req-1", source: "requirements-csv" }
      ],
      requirementIdByExternalId: requirements,
      existingLinkKeys: new Set()
    });

    expect(links).toEqual([
      {
        sourceType: "requirement",
        sourceId: "req-1",
        targetType: "requirement",
        targetId: "req-2",
        linkType: "parent",
        confidence: 0.95,
        source: "requirements-csv"
      }
    ]);
  });

  it("skips parent links that already exist and self references", () => {
    const existing = traceLinkKey({
      sourceType: "requirement",
      sourceId: "req-1",
      targetType: "requirement",
      targetId: "req-2",
      linkType: "parent"
    });
    const links = planParentLinks({
      requirements: [
        { id: "req-2", parentExternalId: "REQ-001", source: "reqif" },
        { id: "req-1", parentExternalId: "REQ-001", source: "reqif" }
      ],
      requirementIdByExternalId: requirements,
      existingLinkKeys: new Set([existing])
    });

    expect(links).toEqual([]);
  });
});
