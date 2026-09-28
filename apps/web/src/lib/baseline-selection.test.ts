import { describe, expect, it } from "vitest";
import { baselinesUrl, CURRENT_STATE, defaultSelection, selectionFromParams } from "./baseline-selection";

// Newest first, as the baselines API lists them.
const three = [{ id: "c" }, { id: "b" }, { id: "a" }];

describe("defaultSelection", () => {
  it("compares the two latest baselines", () => {
    expect(defaultSelection(three)).toEqual({ a: "b", b: "c" });
  });

  it("compares a single baseline with the current state", () => {
    expect(defaultSelection([{ id: "a" }])).toEqual({ a: "a", b: CURRENT_STATE });
  });

  it("has nothing to compare without baselines", () => {
    expect(defaultSelection([])).toEqual({ a: "", b: CURRENT_STATE });
  });
});

describe("selectionFromParams", () => {
  it("uses the selection named in the URL", () => {
    expect(selectionFromParams(three, new URLSearchParams("a=a&b=b"))).toEqual({ a: "a", b: "b" });
    expect(selectionFromParams(three, new URLSearchParams("a=c&b=current"))).toEqual({ a: "c", b: CURRENT_STATE });
  });

  it("falls back to the default for a missing or unknown side", () => {
    expect(selectionFromParams(three, new URLSearchParams(""))).toEqual({ a: "b", b: "c" });
    expect(selectionFromParams(three, new URLSearchParams("a=deleted&b=current"))).toEqual({ a: "b", b: CURRENT_STATE });
    expect(selectionFromParams(three, new URLSearchParams("a=a&b=deleted"))).toEqual({ a: "a", b: "c" });
    expect(selectionFromParams(three, new URLSearchParams("a=current&b=a"))).toEqual({ a: "b", b: "a" });
  });

  it("ignores a URL selection when there are no baselines", () => {
    expect(selectionFromParams([], new URLSearchParams("a=a&b=b"))).toEqual({ a: "", b: CURRENT_STATE });
  });
});

describe("baselinesUrl", () => {
  it("adds the selection to the page address", () => {
    expect(baselinesUrl("p1", { a: "a", b: CURRENT_STATE })).toBe("/projects/p1/baselines?a=a&b=current");
    expect(baselinesUrl("p1", { a: "x y", b: "z&1" })).toBe("/projects/p1/baselines?a=x+y&b=z%261");
  });

  it("returns the plain page without a selection", () => {
    expect(baselinesUrl("p1")).toBe("/projects/p1/baselines");
    expect(baselinesUrl("p1", { a: "", b: CURRENT_STATE })).toBe("/projects/p1/baselines");
  });
});
