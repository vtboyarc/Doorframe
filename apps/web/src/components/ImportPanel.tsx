"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type SourceType = "requirements-csv" | "jira-csv" | "junit-xml" | "reqif" | "reqifz";

const importTypes: Array<{ value: SourceType; label: string }> = [
  { value: "requirements-csv", label: "Requirements CSV" },
  { value: "jira-csv", label: "Jira CSV" },
  { value: "junit-xml", label: "JUnit XML" },
  { value: "reqif", label: "ReqIF" },
  { value: "reqifz", label: "ReqIFZ" }
];

const requirementFields = [
  ["requirementId", "Requirement ID"],
  ["title", "Title"],
  ["text", "Text"],
  ["status", "Status"],
  ["type", "Type"],
  ["priority", "Priority"],
  ["verificationMethod", "Verification method"],
  ["parentId", "Parent ID"]
];

const jiraFields = [
  ["issueKey", "Issue key"],
  ["summary", "Summary"],
  ["description", "Description"],
  ["status", "Status"],
  ["issueType", "Issue type"],
  ["assignee", "Assignee"],
  ["requirementIds", "Requirement IDs"]
];

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function guessColumn(columns: string[], field: string): string {
  const normalized = columns.map((column) => [column, column.toLowerCase().replace(/[^a-z0-9]/g, "")] as const);
  const aliases: Record<string, string[]> = {
    requirementId: ["id", "requirementid", "reqid", "externalid"],
    title: ["title", "name", "summary"],
    text: ["text", "description", "requirementtext", "primarytext"],
    status: ["status", "state"],
    type: ["type", "requirementtype"],
    priority: ["priority"],
    verificationMethod: ["verificationmethod", "verification", "verifmethod"],
    parentId: ["parentid", "parent", "parentrequirement"],
    issueKey: ["key", "issuekey", "id"],
    summary: ["summary", "title"],
    description: ["description", "text"],
    issueType: ["issuetype", "type"],
    assignee: ["assignee", "owner"],
    requirementIds: ["requirementids", "requirements", "reqids", "linkedrequirements"]
  };

  return normalized.find(([, key]) => aliases[field]?.includes(key))?.[0] ?? "";
}

export function ImportPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceType>("requirements-csv");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const activeFields = useMemo(() => {
    if (sourceType === "requirements-csv") {
      return requirementFields;
    }

    if (sourceType === "jira-csv") {
      return jiraFields;
    }

    return [];
  }, [sourceType]);

  async function onFileChange(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
    setErrors([]);

    if (!nextFile || !sourceType.endsWith("csv")) {
      setHeaders([]);
      setPreviewRows([]);
      setMapping({});
      return;
    }

    const text = await nextFile.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const columns = splitCsvLine(lines[0] ?? "");
    const rows = lines.slice(1, 6).map(splitCsvLine);
    const guesses = Object.fromEntries(activeFields.map(([field]) => [field, guessColumn(columns, field)]));

    setHeaders(columns);
    setPreviewRows(rows);
    setMapping(guesses);
  }

  async function submitImport() {
    if (!file) {
      setErrors(["Choose a file before importing."]);
      return;
    }

    setIsImporting(true);
    setResult(null);
    setErrors([]);

    const formData = new FormData();
    formData.set("sourceType", sourceType);
    formData.set("file", file);
    formData.set("mapping", JSON.stringify(mapping));

    const response = await fetch(`/api/projects/${projectId}/import`, {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as {
      recordCount?: number;
      linkCount?: number;
      findingCount?: number;
      errors?: string[];
      error?: string;
    };

    setIsImporting(false);

    if (!response.ok) {
      setErrors([payload.error ?? "Import failed."]);
      return;
    }

    setResult(
      `Imported ${payload.recordCount ?? 0} records, created ${payload.linkCount ?? 0} trace links, and generated ${
        payload.findingCount ?? 0
      } findings.`
    );
    setErrors(payload.errors ?? []);
    router.refresh();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="border border-[var(--line)] bg-white p-4">
        <label className="block text-sm font-medium" htmlFor="source-type">
          Import type
        </label>
        <select
          id="source-type"
          value={sourceType}
          onChange={(event) => {
            setSourceType(event.target.value as SourceType);
            void onFileChange(file);
          }}
          className="mt-2 min-h-10 w-full border border-[var(--line)] bg-white px-3"
        >
          {importTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium" htmlFor="import-file">
          File
        </label>
        <input
          id="import-file"
          type="file"
          onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
          className="mt-2 w-full border border-[var(--line)] bg-white p-2"
        />

        {activeFields.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-medium">Column mapping</div>
            {activeFields.map(([field, label]) => (
              <label key={field} className="block text-sm">
                <span className="text-[var(--muted)]">{label}</span>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
                  className="mt-1 min-h-9 w-full border border-[var(--line)] bg-white px-2"
                >
                  <option value="">Unmapped</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submitImport}
          disabled={isImporting}
          className="mt-5 flex min-h-10 w-full items-center justify-center gap-2 border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-white disabled:opacity-60"
        >
          <Upload size={16} />
          {isImporting ? "Importing" : "Import file"}
        </button>

        {result ? <p className="mt-3 text-sm text-[var(--accent-strong)]">{result}</p> : null}
        {errors.length > 0 ? (
          <div className="mt-3 border border-[var(--warning)] bg-[#fff8e8] p-3 text-sm">
            <div className="font-medium">Import messages</div>
            <ul className="mt-1 list-inside list-disc">
              {errors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border border-[var(--line)] bg-white p-4">
        <h2 className="text-base font-semibold">Preview</h2>
        {previewRows.length > 0 ? (
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="border border-[var(--line)] bg-[var(--background)] p-2 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={index}>
                    {headers.map((header, headerIndex) => (
                      <td key={header} className="max-w-[260px] border border-[var(--line)] p-2">
                        {row[headerIndex]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            CSV files show a preview before saving. XML and ReqIF imports are parsed on import.
          </p>
        )}
      </div>
    </section>
  );
}
