export type UploadEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

export interface DecodedUpload {
  text: string;
  encoding: UploadEncoding;
  /** Set when the file was not UTF-8 and was read with a fallback encoding. */
  warning?: string;
  /**
   * Set when the text still contains NUL characters, so it is probably UTF-16
   * or binary. CSV previews and imports reject the upload with it.
   */
  error?: string;
}

export const UTF16_WITHOUT_BOM_WARNING =
  "This file looks like UTF-16 without a byte-order mark, so Doorframe read it as UTF-16. Check that IDs and text look right, or save the file as CSV UTF-8 and import it again.";

export const NUL_CHARACTERS_MESSAGE =
  "This file contains NUL characters, so it may be UTF-16 text without a byte-order mark or a binary file such as a spreadsheet workbook. Save it as UTF-8 text (CSV UTF-8 for spreadsheets) and import it again.";

/** Bytes inspected when guessing UTF-16 without a byte-order mark. */
const UTF16_SAMPLE_BYTES = 4096;

/** Share of zero bytes in one byte position (odd or even) that marks ASCII-heavy UTF-16. */
const UTF16_ZERO_SHARE = 0.3;

/** Share of zero bytes above which the other byte position rules UTF-16 out (binary data). */
const BINARY_ZERO_SHARE = 0.05;

/**
 * Guess the byte order of UTF-16 text written without a byte-order mark. Text
 * that is mostly ASCII has a zero in every other byte: the odd bytes for
 * little-endian, the even bytes for big-endian. Binary files have zeros in
 * both positions and are not treated as UTF-16.
 */
export function sniffUtf16WithoutBom(bytes: Uint8Array): "utf-16le" | "utf-16be" | null {
  const length = Math.min(bytes.length, UTF16_SAMPLE_BYTES) & ~1;
  if (length < 2) {
    return null;
  }

  let evenZeros = 0;
  let oddZeros = 0;
  for (let index = 0; index < length; index += 2) {
    if (bytes[index] === 0) evenZeros += 1;
    if (bytes[index + 1] === 0) oddZeros += 1;
  }

  const pairs = length / 2;
  const evenShare = evenZeros / pairs;
  const oddShare = oddZeros / pairs;

  if (oddShare > UTF16_ZERO_SHARE && evenShare <= BINARY_ZERO_SHARE) {
    return "utf-16le";
  }

  if (evenShare > UTF16_ZERO_SHARE && oddShare <= BINARY_ZERO_SHARE) {
    return "utf-16be";
  }

  return null;
}

/**
 * Characters for bytes 0x80-0x9F in Windows-1252 (WHATWG encoding index).
 * Every other byte maps to the code point with the same value. Decoded by hand
 * because some Node versions read "windows-1252" as ISO-8859-1.
 */
const WINDOWS_1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178
];

const DECODE_CHUNK = 8192;

export function decodeWindows1252(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += DECODE_CHUNK) {
    const codes = Array.from(bytes.subarray(start, start + DECODE_CHUNK), (byte) =>
      byte >= 0x80 && byte <= 0x9f ? WINDOWS_1252_HIGH[byte - 0x80] : byte
    );
    parts.push(String.fromCharCode(...codes));
  }
  return parts.join("");
}

/**
 * Decode an uploaded text file. Honors UTF-8 and UTF-16 byte-order marks,
 * recognizes UTF-16 written without one, accepts valid UTF-8, and otherwise
 * falls back to Windows-1252 (Excel's default "CSV" encoding on Windows)
 * instead of silently replacing characters. Text that still contains NUL
 * characters comes back with an `error`, because NUL bytes are valid UTF-8 and
 * would otherwise be saved inside IDs.
 */
export function decodeUpload(bytes: Uint8Array): DecodedUpload {
  const decoded = decodeText(bytes);
  return decoded.text.includes("\u0000") ? { ...decoded, error: NUL_CHARACTERS_MESSAGE } : decoded;
}

function decodeText(bytes: Uint8Array): DecodedUpload {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" };
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" };
  }

  const utf16 = sniffUtf16WithoutBom(bytes);
  if (utf16) {
    return { text: new TextDecoder(utf16).decode(bytes), encoding: utf16, warning: UTF16_WITHOUT_BOM_WARNING };
  }

  try {
    // ignoreBOM: false (the default) strips a UTF-8 BOM.
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return {
      text: decodeWindows1252(bytes),
      encoding: "windows-1252",
      warning:
        "This file is not UTF-8, so Doorframe read it as Windows-1252. Check that special characters such as ±, °, and curly quotes look right, or save the file as CSV UTF-8 and import it again."
    };
  }
}
