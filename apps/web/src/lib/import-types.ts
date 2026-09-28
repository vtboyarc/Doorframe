/**
 * Import types, column-mapping fields, and API payload shapes shared by the
 * imports page (client) and the import API routes (server). Keep this module
 * free of Node-only imports so the client bundle can use it.
 */

export const IMPORT_SOURCE_TYPES = ["requirements-csv", "jira-csv", "junit-xml", "reqif", "reqifz"] as const;

export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number];

/** The kind of record an import creates or updates. */
export type ImportEntityType = "requirement" | "workItem" | "testCase";

/** Largest upload the web app accepts. Larger exports should go through the CLI. */
export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

/** Most records one "remove missing records" request may delete. */
export const MAX_REMOVABLE_RECORDS = 1000;

/** How many missing record IDs the import result lists on screen. */
export const MISSING_IDS_SHOWN = 50;

export interface ImportTypeInfo {
  value: ImportSourceType;
  label: string;
  entityType: ImportEntityType;
  /** Value for the file input's accept attribute. */
  accept: string;
  /** Lowercase file extensions, with the dot, that fit this type. */
  extensions: string[];
  /** One-line description shown under the type select. */
  description: string;
  /** True when requirement IDs are found with the project's ID patterns. */
  usesIdPatterns: boolean;
}

export const IMPORT_TYPES: ImportTypeInfo[] = [
  {
    value: "requirements-csv",
    label: "Requirements CSV",
    entityType: "requirement",
    accept: ".csv",
    extensions: [".csv"],
    description: "Requirements CSV: one row per requirement. The Requirement ID and Text columns are required.",
    usesIdPatterns: false
  },
  {
    value: "jira-csv",
    label: "Jira CSV",
    entityType: "workItem",
    accept: ".csv",
    extensions: [".csv"],
    description:
      "Jira CSV: work items. Requirement IDs such as REQ-001 in the summary, description, labels, or a requirement IDs column create links.",
    usesIdPatterns: true
  },
  {
    value: "junit-xml",
    label: "JUnit XML",
    entityType: "testCase",
    accept: ".xml",
    extensions: [".xml"],
    description:
      "JUnit XML: test results. Requirement IDs such as REQ-001 in test names or class names create links.",
    usesIdPatterns: true
  },
  {
    value: "reqif",
    label: "ReqIF",
    entityType: "requirement",
    accept: ".reqif,.xml",
    extensions: [".reqif", ".xml"],
    description: "ReqIF: requirements exchanged from a requirements tool as a .reqif file.",
    usesIdPatterns: false
  },
  {
    value: "reqifz",
    label: "ReqIFZ",
    entityType: "requirement",
    accept: ".reqifz,.zip",
    extensions: [".reqifz", ".zip"],
    description: "ReqIFZ: a zip archive that contains one or more .reqif files.",
    usesIdPatterns: false
  }
];

export function isImportSourceType(value: unknown): value is ImportSourceType {
  return typeof value === "string" && (IMPORT_SOURCE_TYPES as readonly string[]).includes(value);
}

export function importTypeInfo(sourceType: ImportSourceType): ImportTypeInfo {
  return IMPORT_TYPES.find((info) => info.value === sourceType) ?? IMPORT_TYPES[0];
}

/** Record kind an import batch created, from its stored source type; null for demo data and unknown types. */
export function entityTypeForSource(sourceType: string): ImportEntityType | null {
  return isImportSourceType(sourceType) ? importTypeInfo(sourceType).entityType : null;
}

export function isCsvImportType(sourceType: ImportSourceType): boolean {
  return sourceType === "requirements-csv" || sourceType === "jira-csv";
}

export const ENTITY_NOUNS: Record<ImportEntityType, { one: string; many: string }> = {
  requirement: { one: "requirement", many: "requirements" },
  workItem: { one: "work item", many: "work items" },
  testCase: { one: "test case", many: "test cases" }
};

// Column mapping ------------------------------------------------------------

/** Column mapping sent by the import form: field key -> CSV header ("" = not imported). */
export type ColumnMapping = Record<string, string>;

export interface MappingField {
  key: string;
  label: string;
  required: boolean;
  /** Label for the empty option; defaults to "Not imported" for optional fields. */
  emptyLabel?: string;
}

export const REQUIREMENT_MAPPING_FIELDS: MappingField[] = [
  { key: "requirementId", label: "Requirement ID", required: true },
  { key: "title", label: "Title", required: false },
  { key: "text", label: "Text", required: true },
  { key: "status", label: "Status", required: false },
  { key: "type", label: "Type", required: false },
  { key: "priority", label: "Priority", required: false },
  { key: "verificationMethod", label: "Verification method", required: false },
  { key: "parentId", label: "Parent ID", required: false }
];

export const JIRA_MAPPING_FIELDS: MappingField[] = [
  { key: "issueKey", label: "Issue key", required: true },
  { key: "summary", label: "Summary", required: false },
  { key: "description", label: "Description", required: false },
  { key: "status", label: "Status", required: false },
  { key: "issueType", label: "Issue type", required: false },
  { key: "assignee", label: "Assignee", required: false },
  // The parser always looks for IDs in summary, description, and label-like
  // columns, so an empty choice here means "detect", not "skip".
  { key: "requirementIds", label: "Requirement IDs", required: false, emptyLabel: "Detect automatically" }
];

export function mappingFieldsFor(sourceType: ImportSourceType): MappingField[] {
  if (sourceType === "requirements-csv") {
    return REQUIREMENT_MAPPING_FIELDS;
  }

  return sourceType === "jira-csv" ? JIRA_MAPPING_FIELDS : [];
}

/** Fill every field of a mapping, using "" for fields with no column. */
export function completeMapping(fields: MappingField[], mapping: Partial<ColumnMapping>): ColumnMapping {
  return Object.fromEntries(fields.map((field) => [field.key, mapping[field.key] ?? ""]));
}

export interface SharedColumn {
  column: string;
  fields: string[];
  includesRequired: boolean;
}

export interface MappingCheck {
  /** Labels of required fields with no column. */
  missingRequired: string[];
  /** Columns chosen for more than one field. */
  sharedColumns: SharedColumn[];
  canImport: boolean;
}

/** Validate a column mapping: required fields must be mapped and must not share a column. */
export function checkMapping(fields: MappingField[], mapping: ColumnMapping): MappingCheck {
  const missingRequired = fields.filter((field) => field.required && !mapping[field.key]).map((field) => field.label);
  const byColumn = new Map<string, MappingField[]>();

  fields.forEach((field) => {
    const column = mapping[field.key];
    if (column) {
      byColumn.set(column, [...(byColumn.get(column) ?? []), field]);
    }
  });

  const sharedColumns = Array.from(byColumn.entries())
    .filter(([, sharing]) => sharing.length > 1)
    .map(([column, sharing]) => ({
      column,
      fields: sharing.map((field) => field.label),
      includesRequired: sharing.some((field) => field.required)
    }));

  return {
    missingRequired,
    sharedColumns,
    canImport: missingRequired.length === 0 && !sharedColumns.some((shared) => shared.includesRequired)
  };
}

// Files ---------------------------------------------------------------------

/** Lowercase extension with the dot, e.g. "Export.CSV" -> ".csv"; "" when there is none. */
export function fileExtension(filename: string): string {
  const match = /\.[^./\\]+$/.exec(filename.trim());
  return match ? match[0].toLowerCase() : "";
}

/**
 * Pick the import type for a newly chosen file from its extension, keeping the
 * current type when it already fits (e.g. Jira CSV stays Jira CSV for a .csv).
 */
export function sourceTypeForFile(filename: string, current: ImportSourceType): ImportSourceType {
  const extension = fileExtension(filename);

  switch (extension) {
    case ".csv":
      return isCsvImportType(current) ? current : "requirements-csv";
    case ".xml":
      return current === "reqif" ? current : "junit-xml";
    case ".reqif":
      return "reqif";
    case ".reqifz":
    case ".zip":
      return "reqifz";
    default:
      return current;
  }
}

/** Hint shown when the chosen file's extension does not fit the selected import type. */
export function fileTypeHint(filename: string, sourceType: ImportSourceType): string | null {
  const info = importTypeInfo(sourceType);
  const extension = fileExtension(filename);

  if (info.extensions.includes(extension)) {
    return null;
  }

  const expected = info.extensions.join(" or ");
  const actual = extension ? `a ${extension} file` : "a file without an extension";
  return `This is ${actual}, but ${info.label} imports expect ${expected}. Check the import type.`;
}

/** Normalized column names (lowercase letters and digits) that Jira CSV exports use, in order of preference. */
const JIRA_EXPORT_COLUMNS = ["issuekey", "issueid", "issuetype"];

/**
 * The column that marks a CSV as a Jira export, such as "Issue key", or null
 * when there is none. The imports page uses it to stop a Jira export from being
 * saved as requirements.
 */
export function jiraExportColumn(headers: string[]): string | null {
  const normalized = headers.map((header) => ({ header, key: header.toLowerCase().replace(/[^a-z0-9]/g, "") }));

  for (const column of JIRA_EXPORT_COLUMNS) {
    const match = normalized.find((entry) => entry.key === column);
    if (match) {
      return match.header;
    }
  }

  return null;
}

/** Normalized column names that only requirement exports (DOORS, spreadsheets) use, in order of preference. */
const REQUIREMENT_EXPORT_COLUMNS = [
  "verificationmethod",
  "requirementid",
  "reqid",
  "requirementtext",
  "objectidentifier",
  "absolutenumber"
];

/**
 * The column that marks a CSV as a requirements export, such as "Verification
 * Method", or null. Files that also have a Jira column are not flagged. The
 * imports page uses it to warn before a requirements file is saved as work items.
 */
export function requirementExportColumn(headers: string[]): string | null {
  if (jiraExportColumn(headers)) {
    return null;
  }

  const normalized = headers.map((header) => ({ header, key: header.toLowerCase().replace(/[^a-z0-9]/g, "") }));
  for (const column of REQUIREMENT_EXPORT_COLUMNS) {
    const match = normalized.find((entry) => entry.key === column);
    if (match) {
      return match.header;
    }
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// API payloads --------------------------------------------------------------

/** Response of POST /api/projects/[projectId]/import/preview. */
export interface ImportPreviewResponse {
  headers: string[];
  rows: string[][];
  totalRows: number;
  mapping: ColumnMapping;
  /** Set when the file was not UTF-8 and was read with another encoding; the import repeats it. */
  encodingWarning?: string;
}

/**
 * imported: at least one record was saved.
 * empty: the file was read but held no usable records.
 * failed: the file could not be read as the chosen type.
 */
export type ImportStatus = "imported" | "empty" | "failed";

/** Records of the imported kind that exist in the project but not in the uploaded file. */
export interface MissingRecords {
  entityType: ImportEntityType;
  count: number;
  /** Sorted IDs, at most {@link MAX_REMOVABLE_RECORDS}; the page lists the first {@link MISSING_IDS_SHOWN}. */
  externalIds: string[];
}

/** Response of POST /api/projects/[projectId]/import. */
export interface ImportResponse {
  status: ImportStatus;
  sourceType: ImportSourceType;
  entityType: ImportEntityType;
  filename: string;
  recordCount: number;
  createdCount: number;
  updatedCount: number;
  /** Trace links created by this import (links that already existed are not counted). */
  linkCount: number;
  /** Total findings in the project after the import. */
  findingCount: number;
  /** Plain-language reason when status is "empty" or "failed". */
  message?: string;
  /** Raw parser text behind `message`, for troubleshooting. */
  detail?: string;
  /** Row-level warnings from the parser, in plain language where known. */
  errors: string[];
  missing: MissingRecords | null;
}

/** Error body returned with a non-2xx status by the import API routes. */
export interface ImportErrorResponse {
  error: string;
  detail?: string;
}

export interface RemoveRecordsRequest {
  entityType: ImportEntityType;
  externalIds: string[];
}

/** Response of POST /api/projects/[projectId]/records/remove. */
export interface RemoveRecordsResponse {
  entityType: ImportEntityType;
  removedCount: number;
  removedExternalIds: string[];
  removedLinkCount: number;
  findingCount: number;
}
