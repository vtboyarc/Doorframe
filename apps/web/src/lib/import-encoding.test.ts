import { describe, expect, it } from "vitest";
import { decodeUpload } from "./import-encoding";

describe("decodeUpload", () => {
  it("reads UTF-8 with or without a byte-order mark", () => {
    const text = "ID,Text\nREQ-1,Tolerance ±2 °C\n";
    const utf8 = new TextEncoder().encode(text);

    expect(decodeUpload(utf8)).toEqual({ text, encoding: "utf-8" });
    expect(decodeUpload(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8])).text).toBe(text);
  });

  it("falls back to Windows-1252 with a warning instead of replacement characters", () => {
    // "±2 °C" and a right single quote, as Excel writes them on Windows.
    const bytes = new Uint8Array([0x52, 0x2c, 0xb1, 0x32, 0x20, 0xb0, 0x43, 0x92, 0x73]);
    const decoded = decodeUpload(bytes);

    expect(decoded.encoding).toBe("windows-1252");
    expect(decoded.text).toBe("R,±2 °C’s");
    expect(decoded.warning).toMatch(/not UTF-8/);
  });

  it("reads UTF-16 files that start with a byte-order mark", () => {
    const le = new Uint8Array([0xff, 0xfe, 0x49, 0x00, 0x44, 0x00]);
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x49, 0x00, 0x44]);

    expect(decodeUpload(le)).toEqual({ text: "ID", encoding: "utf-16le" });
    expect(decodeUpload(be)).toEqual({ text: "ID", encoding: "utf-16be" });
  });
});
