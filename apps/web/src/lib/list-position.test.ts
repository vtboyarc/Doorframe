import { describe, expect, it } from "vitest";
import { listPositionKey, parseListPosition, readListPosition, writeListPosition } from "./list-position";
import type { StorageLike } from "./session-store";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key)
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  }
};

describe("listPositionKey", () => {
  it("prefers the history entry key", () => {
    expect(listPositionKey({ pathname: "/projects/p/matrix", search: "" }, "entry-1")).toBe(
      "doorframe:list-position:entry:entry-1"
    );
  });

  it("falls back to the address without the Navigation API", () => {
    expect(listPositionKey({ pathname: "/projects/p/requirements", search: "?q=alert" }, null)).toBe(
      "doorframe:list-position:url:/projects/p/requirements?q=alert"
    );
  });
});

describe("parseListPosition", () => {
  it("reads a stored position", () => {
    expect(parseListPosition('{"top":900}')).toEqual({ top: 900 });
    expect(parseListPosition('{"top":120.5,"count":400}')).toEqual({ top: 120.5, count: 400 });
  });

  it("ignores values it did not write", () => {
    expect(parseListPosition(null)).toBeNull();
    expect(parseListPosition("")).toBeNull();
    expect(parseListPosition("not json")).toBeNull();
    expect(parseListPosition("null")).toBeNull();
    expect(parseListPosition('{"top":"900"}')).toBeNull();
    expect(parseListPosition('{"top":-5}')).toBeNull();
    expect(parseListPosition('{"top":10,"count":0}')).toEqual({ top: 10 });
    expect(parseListPosition('{"top":10,"count":2.5}')).toEqual({ top: 10 });
  });
});

describe("readListPosition and writeListPosition", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    writeListPosition(storage, "k", { top: 899.6, count: 400 });
    expect(storage.data.get("k")).toBe('{"top":900,"count":400}');
    expect(readListPosition(storage, "k")).toEqual({ top: 900, count: 400 });
    writeListPosition(storage, "k", { top: 12 });
    expect(readListPosition(storage, "k")).toEqual({ top: 12 });
  });

  it("works without storage and when storage throws", () => {
    expect(readListPosition(null, "k")).toBeNull();
    expect(() => writeListPosition(null, "k", { top: 1 })).not.toThrow();
    expect(readListPosition(throwingStorage, "k")).toBeNull();
    expect(() => writeListPosition(throwingStorage, "k", { top: 1 })).not.toThrow();
  });
});
