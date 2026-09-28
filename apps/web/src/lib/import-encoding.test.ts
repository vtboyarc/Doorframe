import { describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import {
  decodeUpload,
  decodeWindows1252,
  NUL_CHARACTERS_MESSAGE,
  sniffUtf16WithoutBom,
  UTF16_WITHOUT_BOM_WARNING
} from "./import-encoding";

const CSV = "ID,Title,Text,Status\r\nREQ-1,Temp,\"The system shall hold 2 °C within 5 seconds.\",Approved\r\n";

function utf16be(text: string): Uint8Array {
  const le = Buffer.from(text, "utf16le");
  const be = new Uint8Array(le.length);
  for (let index = 0; index < le.length; index += 2) {
    be[index] = le[index + 1];
    be[index + 1] = le[index];
  }
  return be;
}

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

  it("maps the Windows-1252 bytes that differ from ISO-8859-1", () => {
    expect(decodeWindows1252(new Uint8Array([0x80, 0x93, 0x94, 0x96, 0x97, 0x99, 0x9f]))).toBe("€“”–—™Ÿ");
    expect(decodeWindows1252(new Uint8Array([0x41, 0xe9, 0xff]))).toBe("Aéÿ");
    expect(decodeWindows1252(new Uint8Array(20000).fill(0x61))).toBe("a".repeat(20000));
  });

  it("reads UTF-16 files that start with a byte-order mark", () => {
    const le = new Uint8Array([0xff, 0xfe, 0x49, 0x00, 0x44, 0x00]);
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x49, 0x00, 0x44]);

    expect(decodeUpload(le)).toEqual({ text: "ID", encoding: "utf-16le" });
    expect(decodeUpload(be)).toEqual({ text: "ID", encoding: "utf-16be" });
  });

  it("reads UTF-16LE without a byte-order mark, with a warning", () => {
    const decoded = decodeUpload(new Uint8Array(Buffer.from(CSV, "utf16le")));

    expect(decoded).toEqual({ text: CSV, encoding: "utf-16le", warning: UTF16_WITHOUT_BOM_WARNING });
  });

  it("reads UTF-16BE without a byte-order mark, with a warning", () => {
    const decoded = decodeUpload(utf16be(CSV));

    expect(decoded).toEqual({ text: CSV, encoding: "utf-16be", warning: UTF16_WITHOUT_BOM_WARNING });
  });

  it("rejects text that still contains NUL characters", () => {
    const bytes = new TextEncoder().encode("ID,Text\nREQ-1,A\u0000B\n");
    const decoded = decodeUpload(bytes);

    expect(decoded.encoding).toBe("utf-8");
    expect(decoded.error).toBe(NUL_CHARACTERS_MESSAGE);
  });

  it("rejects binary data with zeros in both byte positions", () => {
    const binary = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0xff, 0x00]);
    const decoded = decodeUpload(binary);

    expect(sniffUtf16WithoutBom(binary)).toBeNull();
    expect(decoded.error).toBe(NUL_CHARACTERS_MESSAGE);
  });

  it("does not report an error for ordinary files", () => {
    expect(decodeUpload(new TextEncoder().encode(CSV)).error).toBeUndefined();
    expect(decodeUpload(new Uint8Array([0x52, 0xb1])).error).toBeUndefined();
  });
});

describe("sniffUtf16WithoutBom", () => {
  it("recognizes the byte order of ASCII-heavy UTF-16", () => {
    expect(sniffUtf16WithoutBom(new Uint8Array(Buffer.from(CSV, "utf16le")))).toBe("utf-16le");
    expect(sniffUtf16WithoutBom(utf16be(CSV))).toBe("utf-16be");
  });

  it("ignores UTF-8, Windows-1252, and tiny inputs", () => {
    expect(sniffUtf16WithoutBom(new TextEncoder().encode(CSV))).toBeNull();
    expect(sniffUtf16WithoutBom(new Uint8Array([0x52, 0x2c, 0xb1, 0x32]))).toBeNull();
    expect(sniffUtf16WithoutBom(new Uint8Array([0x41]))).toBeNull();
    expect(sniffUtf16WithoutBom(new Uint8Array([]))).toBeNull();
  });
});
