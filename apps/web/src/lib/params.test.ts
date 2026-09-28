import { describe, expect, it } from "vitest";
import { routeIdCandidates, safeDecode } from "./params";

describe("route params", () => {
  it("decodes when possible and never throws", () => {
    expect(safeDecode("REQ%20001")).toBe("REQ 001");
    expect(safeDecode("REQ-50%")).toBe("REQ-50%");
  });

  it("tries the value as given before a decoded copy", () => {
    expect(routeIdCandidates("SYS%20001")).toEqual(["SYS%20001", "SYS 001"]);
    expect(routeIdCandidates("REQ-001")).toEqual(["REQ-001"]);
    expect(routeIdCandidates("REQ-50%")).toEqual(["REQ-50%"]);
  });
});
