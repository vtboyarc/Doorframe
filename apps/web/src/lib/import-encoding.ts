export type UploadEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

export interface DecodedUpload {
  text: string;
  encoding: UploadEncoding;
  /** Set when the file was not UTF-8 and was read with a fallback encoding. */
  warning?: string;
}

/**
 * Decode an uploaded text file. Honors UTF-8 and UTF-16 byte-order marks,
 * accepts valid UTF-8, and otherwise falls back to Windows-1252 (Excel's
 * default "CSV" encoding on Windows) instead of silently replacing characters.
 */
export function decodeUpload(bytes: Uint8Array): DecodedUpload {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" };
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" };
  }

  try {
    // ignoreBOM: false (the default) strips a UTF-8 BOM.
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "windows-1252",
      warning:
        "This file is not UTF-8, so Doorframe read it as Windows-1252. Check that special characters such as ±, °, and curly quotes look right, or save the file as CSV UTF-8 and import it again."
    };
  }
}
