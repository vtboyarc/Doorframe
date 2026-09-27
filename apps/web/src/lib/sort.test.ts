import { describe, expect, it } from "vitest";
import { compareExternalIds } from "./sort";

describe("compareExternalIds", () => {
  it("sorts numeric parts by value and ignores case", () => {
    expect(["REQ-10", "REQ-2", "REQ-100", "REQ-1", "req-3"].sort(compareExternalIds)).toEqual([
      "REQ-1",
      "REQ-2",
      "req-3",
      "REQ-10",
      "REQ-100"
    ]);
  });

  it("keeps prefixes grouped before comparing numbers", () => {
    expect(["SYS-2", "REQ-2", "REQ-1.10", "REQ-1.2"].sort(compareExternalIds)).toEqual(["REQ-1.2", "REQ-1.10", "REQ-2", "SYS-2"]);
  });
});
