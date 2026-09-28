import { describe, expect, it } from "vitest";
import { reportFilename } from "./report-filename";

describe("reportFilename", () => {
  it("slugs the project name and uses the local date", () => {
    const now = new Date(2026, 0, 5, 23, 30);
    expect(reportFilename("Falcon Telemetry Gateway (Demo)", "traceability", "html", now)).toBe(
      "falcon-telemetry-gateway-demo-traceability-2026-01-05.html"
    );
    expect(reportFilename("  ***  ", "baseline-diff", "html", now)).toBe("doorframe-baseline-diff-2026-01-05.html");
  });
});
