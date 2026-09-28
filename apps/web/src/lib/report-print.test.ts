import { describe, expect, it } from "vitest";
import { isFrameDocumentReady, isPrintShortcut } from "./report-print";

const key = (overrides: Partial<Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">>) => ({
  key: "p",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides
});

describe("isPrintShortcut", () => {
  it("matches Ctrl+P and Cmd+P", () => {
    expect(isPrintShortcut(key({ ctrlKey: true }))).toBe(true);
    expect(isPrintShortcut(key({ metaKey: true }))).toBe(true);
    expect(isPrintShortcut(key({ key: "P", ctrlKey: true }))).toBe(true);
  });

  it("leaves other keys and combinations alone", () => {
    expect(isPrintShortcut(key({}))).toBe(false);
    expect(isPrintShortcut(key({ key: "o", ctrlKey: true }))).toBe(false);
    expect(isPrintShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPrintShortcut(key({ ctrlKey: true, altKey: true }))).toBe(false);
  });
});

describe("isFrameDocumentReady", () => {
  it("is ready once the preview document has loaded", () => {
    expect(isFrameDocumentReady({ href: "http://localhost:3100/api/projects/p/report?preview=1", readyState: "complete" })).toBe(
      true
    );
  });

  it("is not ready while the frame is empty or still loading", () => {
    expect(isFrameDocumentReady({ href: "about:blank", readyState: "complete" })).toBe(false);
    expect(isFrameDocumentReady({ href: "http://localhost:3100/api/projects/p/report?preview=1", readyState: "interactive" })).toBe(
      false
    );
    expect(isFrameDocumentReady({})).toBe(false);
  });
});
