import {
  asArray,
  isRecord,
  normalizeRequirementId,
  normalizeText,
  type ParseResult,
  requirementInputSchema
} from "@doorframe/core";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { ParsedRequirement } from "./types";

type XmlNode = Record<string, unknown>;

function findNodes(node: unknown, key: string): XmlNode[] {
  if (!isRecord(node)) {
    return [];
  }

  const matches = Object.entries(node).flatMap(([entryKey, value]) => {
    const direct = entryKey === key ? asArray(value as XmlNode | XmlNode[]) : [];
    const nested = asArray(value as XmlNode | XmlNode[]).flatMap((child) => findNodes(child, key));
    return [...direct, ...nested];
  });

  return matches.filter(isRecord);
}

function collectText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(collectText).filter(Boolean).join(" ");
  }

  if (!isRecord(value)) {
    return "";
  }

  const ownText = String(value["@_THE-VALUE"] ?? value["@_LONG-NAME"] ?? value["#text"] ?? "");
  const childText = Object.entries(value)
    .filter(([key]) => !key.startsWith("@_"))
    .map(([, child]) => collectText(child))
    .filter(Boolean)
    .join(" ");

  return normalizeText(`${ownText} ${childText}`);
}

function extractReqifRequirement(specObject: XmlNode): ParsedRequirement {
  const externalId = normalizeRequirementId(
    String(specObject["@_IDENTIFIER"] ?? specObject["@_LONG-NAME"] ?? crypto.randomUUID())
  );
  const longName = String(specObject["@_LONG-NAME"] ?? "");
  const values = findNodes(specObject, "VALUES");
  const attributeText = values.map(collectText).filter(Boolean);
  const longestText = attributeText.sort((a, b) => b.length - a.length)[0] ?? "";

  return {
    externalId,
    title: longName || externalId,
    text: longestText || longName || externalId,
    source: "reqif",
    type: String(specObject["@_DESC"] ?? specObject["@_LAST-CHANGE"] ?? "") || undefined,
    rawAttributes: specObject
  };
}

export function parseReqif(input: string): ParseResult<ParsedRequirement> {
  const parser = new XMLParser({
    attributeNamePrefix: "@_",
    ignoreAttributes: false,
    preserveOrder: false,
    processEntities: false,
    textNodeName: "#text"
  });
  const document = parser.parse(input) as XmlNode;
  const specObjects = findNodes(document, "SPEC-OBJECT");
  const records: ParsedRequirement[] = [];
  const errors: string[] = [];

  specObjects.forEach((specObject, index) => {
    const candidate = extractReqifRequirement(specObject);
    const validation = requirementInputSchema.safeParse(candidate);
    if (!validation.success) {
      errors.push(
        `SPEC-OBJECT ${index + 1}: ${validation.error.issues.map((issue) => issue.message).join(", ")}`
      );
      return;
    }

    records.push(validation.data);
  });

  return { records, errors };
}

export async function parseReqifz(input: ArrayBuffer | Buffer): Promise<ParseResult<ParsedRequirement>> {
  const zip = await JSZip.loadAsync(input);
  const reqifFile = Object.values(zip.files).find((file) => /\.reqif$/i.test(file.name));

  if (!reqifFile) {
    return { records: [], errors: ["No .reqif file found inside ReqIFZ archive."] };
  }

  const reqifXml = await reqifFile.async("string");
  return parseReqif(reqifXml);
}
