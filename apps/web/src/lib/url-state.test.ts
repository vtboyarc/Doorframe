import { describe, expect, it } from "vitest";
import { parseSort, pathAndSearch, requirementListUrl, serializeSort, traceGraphUrl } from "./url-state";

describe("pathAndSearch", () => {
  it("drops the origin and hash so spellings of one address compare equal", () => {
    expect(pathAndSearch("http://localhost:3100/projects/p/requirements?q=a+b#top")).toBe("/projects/p/requirements?q=a+b");
    expect(pathAndSearch("/projects/p/requirements?q=a+b", "http://localhost:3100/projects/p")).toBe(
      "/projects/p/requirements?q=a+b"
    );
  });

  it("encodes characters the address bar would encode", () => {
    expect(pathAndSearch("/projects/p/requirements?q=a b")).toBe(pathAndSearch("/projects/p/requirements?q=a%20b"));
  });

  it("keeps an empty query out", () => {
    expect(pathAndSearch("/projects/p/trace-graph?")).toBe("/projects/p/trace-graph");
  });
});

describe("sort parameter", () => {
  it("parses ascending and descending columns", () => {
    expect(parseSort("title")).toEqual([{ id: "title", desc: false }]);
    expect(parseSort("-status")).toEqual([{ id: "status", desc: true }]);
    expect(parseSort("")).toEqual([]);
    expect(parseSort(null)).toEqual([]);
    expect(parseSort(undefined)).toEqual([]);
  });

  it("round-trips", () => {
    expect(serializeSort(parseSort("-findingCount"))).toBe("-findingCount");
    expect(serializeSort([])).toBeUndefined();
  });
});

describe("requirementListUrl", () => {
  it("returns the plain page when nothing is set", () => {
    expect(requirementListUrl("p1", { query: "", sorting: [] })).toBe("/projects/p1/requirements");
  });

  it("orders view, filter, and sort and trims the filter", () => {
    expect(requirementListUrl("p1", { view: "without-work", query: "  sensor data ", sorting: [{ id: "title", desc: true }] })).toBe(
      "/projects/p1/requirements?view=without-work&q=sensor+data&sort=-title"
    );
  });

  it("leaves out a blank filter", () => {
    expect(requirementListUrl("p1", { query: "   ", sorting: [{ id: "status", desc: false }] })).toBe(
      "/projects/p1/requirements?sort=status"
    );
  });

  it("encodes filter text that has URL syntax", () => {
    const url = requirementListUrl("p1", { query: "a&b=c #1 50%", sorting: [] });
    expect(new URL(url, "http://localhost").searchParams.get("q")).toBe("a&b=c #1 50%");
  });
});

describe("traceGraphUrl", () => {
  const path = "/projects/p1/trace-graph";

  it("leaves out the default view and a missing focus", () => {
    expect(traceGraphUrl(path, { view: "all", defaultView: "all" })).toBe(path);
  });

  it("adds the focus and a non-default view", () => {
    expect(traceGraphUrl(path, { focus: "REQ-014", view: "attention", defaultView: "all" })).toBe(
      `${path}?focus=REQ-014&view=attention`
    );
    expect(traceGraphUrl(path, { focus: "REQ 50%", view: "all", defaultView: "attention" })).toBe(
      `${path}?focus=REQ+50%25&view=all`
    );
  });
});
