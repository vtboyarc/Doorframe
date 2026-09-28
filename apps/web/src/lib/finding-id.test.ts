import { describe, expect, it } from "vitest";
import type { FindingInput } from "@doorframe/core";
import { stableFindingId } from "./finding-id";

const finding: FindingInput = {
  severity: "error",
  category: "missing_verification",
  title: "REQ-001 has no linked test case",
  description: "No JUnit test case is linked to this requirement.",
  entityType: "requirement",
  entityId: "req-1"
};

describe("stableFindingId", () => {
  it("returns the same id for the same finding across analysis runs", () => {
    expect(stableFindingId("project-1", finding, new Map())).toBe(stableFindingId("project-1", finding, new Map()));
  });

  it("differs by project, entity, and title", () => {
    const base = stableFindingId("project-1", finding, new Map());

    expect(stableFindingId("project-2", finding, new Map())).not.toBe(base);
    expect(stableFindingId("project-1", { ...finding, entityId: "req-2" }, new Map())).not.toBe(base);
    expect(stableFindingId("project-1", { ...finding, title: "Other" }, new Map())).not.toBe(base);
  });

  it("keeps identical findings in one run distinct", () => {
    const seen = new Map<string, number>();
    const first = stableFindingId("project-1", finding, seen);
    const second = stableFindingId("project-1", finding, seen);

    expect(second).not.toBe(first);
    expect(second.startsWith(first)).toBe(true);
  });
});
