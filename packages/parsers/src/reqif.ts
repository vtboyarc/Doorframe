import {
  asArray,
  normalizeRequirementId,
  type ParseResult,
  type RawAttributes,
  requirementInputSchema
} from "@doorframe/core";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { ParsedRequirement } from "./types";

type XmlNode = Record<string, unknown>;

function textValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(textValue).join(" ").trim();
  }

  if (typeof value === "object") {
    const node = value as XmlNode;
    return textValue(node["#text"] ?? node["@_THE-VALUE"] ?? node["@_LONG-NAME"]);
  }

  return "";
}

/** Recursively concatenate all text nodes under a value (handles XHTML). */
function deepText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(deepText).join(" ");
  }

  if (typeof value === "object") {
    const node = value as XmlNode;
    return Object.entries(node)
      .filter(([key]) => !key.startsWith("@_") || key === "@_THE-VALUE")
      .map(([key, val]) => (key === "@_THE-VALUE" ? String(val) : deepText(val)))
      .join(" ");
  }

  return "";
}

function findNodes(node: unknown, key: string): XmlNode[] {
  const out: XmlNode[] = [];

  function walk(current: unknown) {
    if (!current || typeof current !== "object") {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    const obj = current as XmlNode;
    Object.entries(obj).forEach(([entryKey, value]) => {
      if (entryKey === key) {
        asArray(value as XmlNode | XmlNode[] | undefined).forEach((item) => out.push(item));
      }

      walk(value);
    });
  }

  walk(node);
  return out;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Map a ReqIF attribute long-name onto a requirement field, if recognized. */
function fieldForAttributeName(name: string): keyof ParsedRequirement | "externalId" | null {
  const n = normalizeName(name);
  if (["id", "identifier", "reqid", "requirementid"].includes(n)) return "externalId";
  if (["title", "name", "longname", "heading", "shortname"].includes(n)) return "title";
  if (["text", "description", "statement", "requirementtext", "objecttext", "specification", "body"].includes(n))
    return "text";
  if (["status", "state"].includes(n)) return "status";
  if (["priority", "severity", "criticality"].includes(n)) return "priority";
  if (["type", "category", "kind", "reqtype"].includes(n)) return "type";
  if (["verification", "verificationmethod", "verifymethod", "verifiedby"].includes(n)) return "verificationMethod";
  return null;
}

/** datatype enum-value identifier -> human label */
function buildEnumValueMap(document: XmlNode): Map<string, string> {
  const map = new Map<string, string>();
  findNodes(document, "ENUM-VALUE").forEach((enumValue) => {
    const id = textValue(enumValue["@_IDENTIFIER"]);
    const label = textValue(enumValue["@_LONG-NAME"]) || id;
    if (id) {
      map.set(id, label);
    }
  });
  return map;
}

/** attribute-definition identifier -> long name */
function buildAttributeDefinitionMap(document: XmlNode): Map<string, string> {
  const map = new Map<string, string>();
  const defKeys = [
    "ATTRIBUTE-DEFINITION-STRING",
    "ATTRIBUTE-DEFINITION-XHTML",
    "ATTRIBUTE-DEFINITION-ENUMERATION",
    "ATTRIBUTE-DEFINITION-INTEGER",
    "ATTRIBUTE-DEFINITION-REAL",
    "ATTRIBUTE-DEFINITION-BOOLEAN",
    "ATTRIBUTE-DEFINITION-DATE"
  ];
  defKeys.forEach((key) => {
    findNodes(document, key).forEach((def) => {
      const id = textValue(def["@_IDENTIFIER"]);
      const longName = textValue(def["@_LONG-NAME"]);
      if (id && longName) {
        map.set(id, longName);
      }
    });
  });
  return map;
}

const VALUE_KEYS = [
  "ATTRIBUTE-VALUE-STRING",
  "ATTRIBUTE-VALUE-XHTML",
  "ATTRIBUTE-VALUE-ENUMERATION",
  "ATTRIBUTE-VALUE-INTEGER",
  "ATTRIBUTE-VALUE-REAL",
  "ATTRIBUTE-VALUE-BOOLEAN",
  "ATTRIBUTE-VALUE-DATE"
];

/** Resolve the attribute-definition reference id that a VALUE points at. */
function definitionRef(value: XmlNode): string {
  const definition = value["DEFINITION"];
  if (!definition || typeof definition !== "object") {
    return "";
  }

  const defNode = definition as XmlNode;
  const refKeys = [
    "ATTRIBUTE-DEFINITION-STRING-REF",
    "ATTRIBUTE-DEFINITION-XHTML-REF",
    "ATTRIBUTE-DEFINITION-ENUMERATION-REF",
    "ATTRIBUTE-DEFINITION-INTEGER-REF",
    "ATTRIBUTE-DEFINITION-REAL-REF",
    "ATTRIBUTE-DEFINITION-BOOLEAN-REF",
    "ATTRIBUTE-DEFINITION-DATE-REF"
  ];
  for (const key of refKeys) {
    if (defNode[key]) {
      return textValue(defNode[key]);
    }
  }
  return "";
}

/** Resolve a single attribute VALUE node to a display string. */
function resolveValueText(value: XmlNode, enumValues: Map<string, string>): string {
  // Enumeration values reference enum-value identifiers.
  const valuesContainer = value["VALUES"];
  if (valuesContainer && typeof valuesContainer === "object") {
    const refs = findNodes(valuesContainer, "ENUM-VALUE-REF").map((ref) => textValue(ref));
    if (refs.length > 0) {
      return refs.map((ref) => enumValues.get(ref) ?? ref).join(", ");
    }
  }

  const direct = value["@_THE-VALUE"];
  if (direct !== undefined) {
    return textValue(direct);
  }

  return deepText(value).trim();
}

/** Build a long-name -> resolved value map for a SPEC-OBJECT. */
function specObjectAttributes(
  specObject: XmlNode,
  attrDefs: Map<string, string>,
  enumValues: Map<string, string>
): Map<string, string> {
  const out = new Map<string, string>();
  const valuesContainer = specObject["VALUES"];
  if (!valuesContainer || typeof valuesContainer !== "object") {
    return out;
  }

  const container = valuesContainer as XmlNode;
  VALUE_KEYS.forEach((key) => {
    asArray(container[key] as XmlNode | XmlNode[] | undefined).forEach((value) => {
      const defId = definitionRef(value);
      const name = attrDefs.get(defId) ?? defId;
      const resolved = resolveValueText(value, enumValues);
      if (name && resolved) {
        out.set(name, resolved);
      }
    });
  });

  return out;
}

/** Map child SPEC-OBJECT identifier -> parent SPEC-OBJECT identifier via SPEC-HIERARCHY. */
function buildParentMap(document: XmlNode): Map<string, string> {
  const parents = new Map<string, string>();

  function objectRef(hierarchy: XmlNode): string {
    const objectNode = hierarchy["OBJECT"];
    if (!objectNode || typeof objectNode !== "object") {
      return "";
    }
    const refs = findNodes(objectNode as XmlNode, "SPEC-OBJECT-REF");
    return refs.length > 0 ? textValue(refs[0]) : "";
  }

  function walk(hierarchy: XmlNode, parentObjectId: string) {
    const selfId = objectRef(hierarchy);
    if (selfId && parentObjectId) {
      parents.set(selfId, parentObjectId);
    }

    const children = hierarchy["CHILDREN"];
    if (children && typeof children === "object") {
      asArray((children as XmlNode)["SPEC-HIERARCHY"] as XmlNode | XmlNode[] | undefined).forEach((child) =>
        walk(child, selfId || parentObjectId)
      );
    }
  }

  findNodes(document, "SPECIFICATION").forEach((specification) => {
    const children = specification["CHILDREN"];
    if (children && typeof children === "object") {
      asArray((children as XmlNode)["SPEC-HIERARCHY"] as XmlNode | XmlNode[] | undefined).forEach((child) =>
        walk(child, "")
      );
    }
  });

  return parents;
}

export function parseReqif(input: string): ParseResult<ParsedRequirement> {
  const parser = new XMLParser({
    attributeNamePrefix: "@_",
    ignoreAttributes: false,
    textNodeName: "#text",
    preserveOrder: false
  });
  const document = parser.parse(input) as XmlNode;
  const specObjects = findNodes(document, "SPEC-OBJECT");
  const attrDefs = buildAttributeDefinitionMap(document);
  const enumValues = buildEnumValueMap(document);
  const parentMap = buildParentMap(document);

  // Map raw SPEC-OBJECT identifier -> normalized external id, for parent resolution.
  const identifierToExternal = new Map<string, string>();
  const records: ParsedRequirement[] = [];
  const errors: string[] = [];

  specObjects.forEach((specObject, index) => {
    const rawIdentifier = textValue(specObject["@_IDENTIFIER"]);
    const attributes = specObjectAttributes(specObject, attrDefs, enumValues);

    const overriddenId = attributes.get(
      Array.from(attributes.keys()).find((key) => fieldForAttributeName(key) === "externalId") ?? ""
    );
    const externalIdRaw =
      overriddenId || rawIdentifier || textValue(specObject["@_LONG-NAME"]) || `REQ-${index + 1}`;
    const externalId = normalizeRequirementId(externalIdRaw);
    if (rawIdentifier) {
      identifierToExternal.set(rawIdentifier, externalId);
    }

    const longName = textValue(specObject["@_LONG-NAME"]);
    const candidate: ParsedRequirement = {
      externalId,
      title: longName || externalId,
      text: "",
      source: "reqif",
      rawAttributes: specObject as RawAttributes
    };

    attributes.forEach((value, name) => {
      const field = fieldForAttributeName(name);
      if (!field || field === "externalId") {
        return;
      }
      if (field === "title") {
        candidate.title = value || candidate.title;
      } else if (field === "text") {
        candidate.text = value || candidate.text;
      } else {
        (candidate as unknown as Record<string, unknown>)[field] = value;
      }
    });

    // Fall back to the original heuristic (longest VALUES text) when no mapped
    // text attribute was found, so simple ReqIF files keep working.
    if (!candidate.text) {
      candidate.text = deepText(specObject["VALUES"]).replace(/\s+/g, " ").trim() || candidate.title;
    }

    records.push(candidate);
  });

  // Resolve parent links now that all external ids are known.
  records.forEach((record) => {
    const rawIdentifier = textValue((record.rawAttributes as XmlNode)["@_IDENTIFIER"]);
    const parentRaw = parentMap.get(rawIdentifier);
    if (parentRaw) {
      const parentExternal = identifierToExternal.get(parentRaw);
      if (parentExternal && parentExternal !== record.externalId) {
        record.parentExternalId = parentExternal;
      }
    }
  });

  const validated: ParsedRequirement[] = [];
  records.forEach((record, index) => {
    const validation = requirementInputSchema.safeParse(record);
    if (!validation.success) {
      errors.push(`SPEC-OBJECT ${index + 1}: ${validation.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }
    validated.push({ ...validation.data, parentExternalId: record.parentExternalId });
  });

  return { records: validated, errors };
}

export async function parseReqifz(input: ArrayBuffer | Buffer): Promise<ParseResult<ParsedRequirement>> {
  const zip = await JSZip.loadAsync(input);
  const reqifFiles = Object.values(zip.files).filter((file) => file.name.toLowerCase().endsWith(".reqif"));

  if (reqifFiles.length === 0) {
    return { records: [], errors: ["No .reqif file found inside the archive."] };
  }

  const records: ParsedRequirement[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const file of reqifFiles) {
    const xml = await file.async("string");
    const result = parseReqif(xml);
    result.errors.forEach((error) => errors.push(`${file.name}: ${error}`));
    result.records.forEach((record) => {
      if (!seen.has(record.externalId)) {
        seen.add(record.externalId);
        records.push(record);
      }
    });
  }

  return { records, errors };
}
