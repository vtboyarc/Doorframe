"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ImportResultPanel } from "@/components/ImportResultPanel";
import { requestImport, requestPreview } from "@/lib/import-client";
import { fileTooLargeMessage, plural, type FailureDescription } from "@/lib/import-messages";
import {
  checkMapping,
  completeMapping,
  fileTypeHint,
  formatFileSize,
  IMPORT_TYPES,
  importTypeInfo,
  isCsvImportType,
  mappingFieldsFor,
  MAX_IMPORT_FILE_BYTES,
  sourceTypeForFile,
  type ColumnMapping,
  type ImportPreviewResponse,
  type ImportResponse,
  type ImportSourceType,
  type MappingCheck
} from "@/lib/import-types";
import { fieldClass, panelClass, primaryButtonClass, textLinkClass } from "@/lib/ui";

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: ImportPreviewResponse }
  | { status: "error"; failure: FailureDescription };

const fileInputClass =
  "mt-2 block w-full min-w-0 text-sm text-[var(--muted)] file:mr-3 file:border file:border-[var(--line-strong)] file:bg-[var(--panel-strong)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--foreground)] hover:file:border-[var(--accent-strong)] disabled:opacity-50";

/** Why the Import button is disabled, or null when it is enabled. */
function blockedReason(input: {
  file: File | null;
  tooLarge: boolean;
  isCsv: boolean;
  preview: PreviewState;
  check: MappingCheck;
}): string | null {
  if (!input.file) {
    return "Choose a file to import.";
  }

  if (input.tooLarge) {
    return "This file is too large to import here.";
  }

  if (!input.isCsv) {
    return null;
  }

  if (input.preview.status === "loading") {
    return "Reading the file…";
  }

  if (input.preview.status !== "ready") {
    return "Fix the problem with this file, or choose another file.";
  }

  if (input.check.missingRequired.length > 0) {
    return `Map ${input.check.missingRequired.join(" and ")} to continue.`;
  }

  return input.check.canImport ? null : "Required fields need their own column.";
}

export function ImportPanel({ projectId, initialType }: { projectId: string; initialType: ImportSourceType }) {
  const router = useRouter();
  const baseId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [sourceType, setSourceType] = useState<ImportSourceType>(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [isImporting, setIsImporting] = useState(false);
  const [failure, setFailure] = useState<FailureDescription | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [resultKey, setResultKey] = useState(0);

  const typeInfo = importTypeInfo(sourceType);
  const isCsv = isCsvImportType(sourceType);
  const fields = mappingFieldsFor(sourceType);
  const tooLarge = file ? file.size > MAX_IMPORT_FILE_BYTES : false;
  const mappingCheck = useMemo(() => checkMapping(fields, mapping), [fields, mapping]);
  const typeHint = file ? fileTypeHint(file.name, sourceType) : null;
  const reason = blockedReason({ file, tooLarge, isCsv, preview, check: mappingCheck });
  const canSubmit = reason === null && !isImporting;
  const settingsHref = `/projects/${encodeURIComponent(projectId)}/settings`;

  // The preview and the mapping are derived from the current file and type, so
  // switching the type after choosing a file always re-reads it for that type.
  useEffect(() => {
    if (!file || !isCsvImportType(sourceType) || file.size > MAX_IMPORT_FILE_BYTES) {
      setPreview({ status: "idle" });
      setMapping({});
      return;
    }

    const controller = new AbortController();
    setPreview({ status: "loading" });
    setMapping({});

    void requestPreview(projectId, sourceType, file, controller.signal).then((outcome) => {
      if (controller.signal.aborted) {
        return;
      }

      if (outcome.ok) {
        setPreview({ status: "ready", preview: outcome.data });
        setMapping(completeMapping(mappingFieldsFor(sourceType), outcome.data.mapping));
      } else {
        setPreview({ status: "error", failure: outcome.failure });
      }
    });

    return () => controller.abort();
  }, [file, sourceType, projectId]);

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [result]);

  function chooseFile(next: File | null) {
    setFile(next);
    setFailure(null);
    if (next) {
      setSourceType((current) => sourceTypeForFile(next.name, current));
    }
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !canSubmit) {
      return;
    }

    setIsImporting(true);
    setFailure(null);
    setResult(null);

    try {
      const outcome = await requestImport(projectId, sourceType, file, isCsv ? mapping : null);
      if (!outcome.ok) {
        setFailure(outcome.failure);
        return;
      }

      setResult(outcome.data);
      setResultKey((key) => key + 1);
      if (outcome.data.status === "imported") {
        clearFile();
      }
      router.refresh();
    } catch {
      setFailure({ message: "The import could not be started. Reload the page and try again." });
    } finally {
      setIsImporting(false);
    }
  }

  const reasonId = `${baseId}-reason`;
  const typeHelpId = `${baseId}-type-help`;
  const fileHelpId = `${baseId}-file-help`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div ref={resultRef} role="status" aria-live="polite" className="min-w-0 scroll-mt-4">
        {result ? <ImportResultPanel key={resultKey} projectId={projectId} result={result} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form
          onSubmit={(event) => void submitImport(event)}
          aria-busy={isImporting}
          aria-labelledby={`${baseId}-form-heading`}
          className={`${panelClass} min-w-0 p-4`}
        >
          <h2 id={`${baseId}-form-heading`} className="text-base font-semibold">
            Import a file
          </h2>

          <label className="mt-4 block text-sm font-medium" htmlFor={`${baseId}-type`}>
            Import type
          </label>
          <select
            id={`${baseId}-type`}
            value={sourceType}
            onChange={(event) => {
              setSourceType(event.target.value as ImportSourceType);
              setFailure(null);
            }}
            disabled={isImporting}
            aria-describedby={typeHelpId}
            className={`mt-2 ${fieldClass}`}
          >
            {IMPORT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p id={typeHelpId} className="mt-2 text-xs text-[var(--muted)]">
            {typeInfo.description}
            {typeInfo.usesIdPatterns ? (
              <>
                {" "}
                ID patterns are configured in{" "}
                <Link href={settingsHref} className={textLinkClass}>
                  Settings
                </Link>
                .
              </>
            ) : null}
          </p>

          <label className="mt-4 block text-sm font-medium" htmlFor={`${baseId}-file`}>
            File
          </label>
          <input
            ref={fileInputRef}
            id={`${baseId}-file`}
            type="file"
            accept={typeInfo.accept}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            disabled={isImporting}
            aria-describedby={fileHelpId}
            className={fileInputClass}
          />
          <div id={fileHelpId} className="mt-2 space-y-1 text-xs">
            {file ? (
              <p className="break-words text-[var(--muted)] [overflow-wrap:anywhere]">
                Selected: <span className="text-[var(--foreground)]">{file.name}</span> ({formatFileSize(file.size)})
              </p>
            ) : (
              <p className="text-[var(--muted)]">
                Accepts {typeInfo.extensions.join(" or ")} files up to {formatFileSize(MAX_IMPORT_FILE_BYTES)}.
              </p>
            )}
            {typeHint ? <p className="text-[var(--warning)]">{typeHint}</p> : null}
            {tooLarge && file ? <p className="text-[var(--danger)]">{fileTooLargeMessage(file.size)}</p> : null}
          </div>

          {isCsv && preview.status === "ready" ? (
            <MappingFields
              baseId={baseId}
              sourceType={sourceType}
              headers={preview.preview.headers}
              mapping={mapping}
              check={mappingCheck}
              disabled={isImporting}
              onChange={(key, column) => setMapping((current) => ({ ...current, [key]: column }))}
            />
          ) : null}

          <p className="mt-5 text-xs text-[var(--muted)]">
            Re-importing updates records with matching IDs. Records missing from a new file are kept unless you remove
            them.
          </p>

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={isImporting}
            aria-describedby={reason ? reasonId : undefined}
            className={`mt-3 w-full ${primaryButtonClass}`}
          >
            <Upload size={16} aria-hidden="true" />
            {isImporting ? "Importing…" : "Import file"}
          </button>
          {isImporting ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Large files can take a minute to analyze.</p>
          ) : reason ? (
            <p id={reasonId} className="mt-2 text-xs text-[var(--muted)]">
              {reason}
            </p>
          ) : null}

          {failure ? (
            <div role="alert" className="mt-3 border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm">
              <p className="break-words">{failure.message}</p>
              {failure.detail ? (
                <p className="mt-1 break-words font-mono text-xs text-[var(--muted)] [overflow-wrap:anywhere]">
                  {failure.detail}
                </p>
              ) : null}
            </div>
          ) : null}
        </form>

        <PreviewPanel baseId={baseId} typeLabel={typeInfo.label} isCsv={isCsv} file={file} preview={preview} />
      </div>
    </div>
  );
}

function MappingFields({
  baseId,
  sourceType,
  headers,
  mapping,
  check,
  disabled,
  onChange
}: {
  baseId: string;
  sourceType: ImportSourceType;
  headers: string[];
  mapping: ColumnMapping;
  check: MappingCheck;
  disabled: boolean;
  onChange: (key: string, column: string) => void;
}) {
  const fields = mappingFieldsFor(sourceType);
  const missing = new Set(check.missingRequired);

  return (
    <fieldset className="mt-5 min-w-0 border-t border-[var(--line)] pt-4" disabled={disabled}>
      <legend className="sr-only">Column mapping</legend>
      <h3 aria-hidden="true" className="text-sm font-medium">
        Column mapping
      </h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Pre-filled from the file headers, as the importer reads them. Fields marked Required must be mapped.
      </p>
      <div className="mt-3 space-y-3">
        {fields.map((field) => {
          const id = `${baseId}-map-${field.key}`;
          return (
            <div key={field.key} className="min-w-0">
              <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-[var(--foreground)]">{field.label}</span>
                {field.required ? <span className="text-xs font-medium text-[var(--warning)]">Required</span> : null}
              </label>
              <select
                id={id}
                value={mapping[field.key] ?? ""}
                onChange={(event) => onChange(field.key, event.target.value)}
                aria-required={field.required || undefined}
                aria-invalid={missing.has(field.label) || undefined}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">{field.required ? "Choose a column" : (field.emptyLabel ?? "Not imported")}</option>
                {headers.map((header, index) => (
                  <option key={index} value={header} disabled={header === ""}>
                    {header || `Column ${index + 1} (no name)`}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {sourceType === "jira-csv" ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Requirement IDs are also detected in the summary, description, and label, component, fix version, custom
          field, requirement, or trace columns.
        </p>
      ) : null}

      {check.sharedColumns.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs">
          {check.sharedColumns.map((shared) => (
            <li
              key={shared.column}
              className={`break-words ${shared.includesRequired ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}
            >
              {shared.fields.join(" and ")} both use the column “{shared.column}”.
              {shared.includesRequired ? " Choose a different column for one of them." : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

function PreviewPanel({
  baseId,
  typeLabel,
  isCsv,
  file,
  preview
}: {
  baseId: string;
  typeLabel: string;
  isCsv: boolean;
  file: File | null;
  preview: PreviewState;
}) {
  const headingId = `${baseId}-preview-heading`;

  return (
    <section className={`${panelClass} min-w-0 p-4`} aria-labelledby={headingId} aria-busy={preview.status === "loading"}>
      <h2 id={headingId} className="text-base font-semibold">
        Preview
      </h2>
      {!isCsv ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {file
            ? `${typeLabel} files are read when you import them. There is no preview for this type.`
            : "CSV files show their first rows here before import. JUnit XML, ReqIF, and ReqIFZ files are read when you import them."}
        </p>
      ) : !file || preview.status === "idle" ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Choose a CSV file to see its first rows and pre-fill the column mapping.
        </p>
      ) : preview.status === "loading" ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Reading the file…</p>
      ) : preview.status === "error" ? (
        <div role="alert" className="mt-3 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm">
          <p className="break-words">{preview.failure.message}</p>
          {preview.failure.detail ? (
            <details className="mt-2">
              <summary className="text-[var(--muted)]">Technical detail</summary>
              <p className="mt-1 break-words font-mono text-xs text-[var(--muted)] [overflow-wrap:anywhere]">
                {preview.failure.detail}
              </p>
            </details>
          ) : null}
        </div>
      ) : (
        <PreviewTable preview={preview.preview} />
      )}
    </section>
  );
}

function duplicateHeaders(headers: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  headers.forEach((header) => {
    if (seen.has(header) && header !== "") {
      duplicates.add(header);
    }
    seen.add(header);
  });
  return Array.from(duplicates);
}

function PreviewTable({ preview }: { preview: ImportPreviewResponse }) {
  const caption =
    preview.totalRows === 0
      ? "The file has a header row but no data rows."
      : preview.rows.length < preview.totalRows
        ? `First ${preview.rows.length} of ${plural(preview.totalRows, "row")}`
        : `All ${plural(preview.totalRows, "row")}`;
  const repeated = duplicateHeaders(preview.headers);

  return (
    <div className="mt-3 min-w-0">
      <p className="text-sm text-[var(--muted)]">
        {caption}
        {preview.totalRows > 0 ? ` · ${plural(preview.headers.length, "column")}` : ""}
      </p>
      {repeated.length > 0 ? (
        <p className="mt-1 break-words text-xs text-[var(--warning)]">
          Repeated column names: {repeated.join(", ")}. The importer reads the last column with each repeated name.
        </p>
      ) : null}
      <div className="mt-3 max-h-[28rem] overflow-auto border border-[var(--line)]">
        <table className="w-max min-w-full border-collapse text-sm">
          <caption className="sr-only">
            File preview: {caption}. Column headers are the first row.
          </caption>
          <thead className="sticky top-0 bg-[var(--panel-strong)]">
            <tr>
              {preview.headers.map((header, index) => (
                <th
                  key={index}
                  scope="col"
                  className="border-b border-r border-[var(--line)] px-3 py-2 text-left align-bottom font-medium last:border-r-0"
                >
                  <div className="max-w-[16rem] break-words">{header || `Column ${index + 1}`}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[var(--line)] last:border-b-0">
                {preview.headers.map((_, cellIndex) => (
                  <td key={cellIndex} className="border-r border-[var(--line)] px-3 py-2 align-top last:border-r-0">
                    <div className="line-clamp-4 max-w-[16rem] whitespace-pre-wrap break-words" title={row[cellIndex] ?? ""}>
                      {row[cellIndex] ?? ""}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
