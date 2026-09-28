import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "./session-store";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sessionStore", () => {
  it("is null on the server", () => {
    expect(sessionStore()).toBeNull();
  });

  it("returns the tab's sessionStorage in a browser", () => {
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    vi.stubGlobal("window", { sessionStorage: storage });

    expect(sessionStore()).toBe(storage);
  });

  it("is null when the browser blocks storage", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("SecurityError");
      }
    });

    expect(sessionStore()).toBeNull();
  });
});
