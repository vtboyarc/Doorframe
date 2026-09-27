import { detectNonCommaDelimiter, readCsvHeaders, readCsvPreview } from "@doorframe/parsers";
import { NextResponse } from "next/server";
import { addImportBatch, getFindings, getProject, getRuleset, recordAuditEvent, runImportTransaction } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { rerunAnalysis } from "@/lib/analysis";
import { decodeUpload } from "@/lib/import-encoding";
import { parseImportFile, saveParsedImport, type ParsedImportFile, type SaveParsedResult } from "@/lib/imports";
import {
  delimiterMessage,
  describeEmptyImport,
  describeImportFailure,
  fileTooLargeMessage,
  friendlyParserMessages,
  isMissingColumnError,
  plural,
  type FailureDescription
} from "@/lib/import-messages";
import { sourceTypeLabel } from "@/lib/labels";
import { parseClientMapping, summarizeMissing } from "@/lib/import-records";
import {
  importTypeInfo,
  isCsvImportType,
  isImportSourceType,
  MAX_IMPORT_FILE_BYTES,
  type ImportErrorResponse,
  type ImportResponse,
  type ImportSourceType,
  type ImportStatus
} from "@/lib/import-types";

export const runtime = "nodejs";

/** Allowance for multipart framing on top of the file itself. */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

function errorResponse(status: number, body: ImportErrorResponse) {
  return NextResponse.json(body, { status });
}

/** Data rows in a CSV, or undefined when the file cannot be read as CSV. */
function csvDataRows(text: string): number | undefined {
  try {
    return readCsvPreview(text, 0).totalRows;
  } catch {
    return undefined;
  }
}

function csvDelimiterProblem(sourceType: ImportSourceType, text: string): string | null {
  if (!isCsvImportType(sourceType)) {
    return null;
  }

  try {
    const delimiter = detectNonCommaDelimiter(readCsvHeaders(text));
    return delimiter ? delimiterMessage(delimiter) : null;
  } catch {
    // Malformed CSV is reported by the parser with a plain-language message.
    return null;
  }
}

function auditSummary(status: ImportStatus, recordCount: number, filename: string, sourceType: ImportSourceType): string {
  return status === "imported"
    ? `Imported ${plural(recordCount, "record")} from ${filename} (${sourceTypeLabel(sourceType)}).`
    : `Import of ${filename} (${sourceTypeLabel(sourceType)}) saved no records.`;
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return errorResponse(404, { error: "Project not found." });
  }

  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > MAX_IMPORT_FILE_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return errorResponse(413, { error: fileTooLargeMessage(declaredBytes) });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, { error: "The upload could not be read. Choose the file again and retry." });
  }

  const sourceType = formData.get("sourceType");
  if (!isImportSourceType(sourceType)) {
    return errorResponse(400, { error: "Choose an import type: Requirements CSV, Jira CSV, JUnit XML, ReqIF, or ReqIFZ." });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, { error: "Choose a file to import." });
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return errorResponse(413, { error: fileTooLargeMessage(file.size) });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // ReqIFZ is a zip archive and is read from the buffer; everything else is text.
  const decoded = sourceType === "reqifz" ? { text: "", warning: undefined } : decodeUpload(buffer);
  const text = decoded.text;

  const delimiterProblem = csvDelimiterProblem(sourceType, text);
  if (delimiterProblem) {
    return errorResponse(422, { error: delimiterProblem });
  }

  try {
    let parsed: ParsedImportFile | null = null;
    let failure: FailureDescription | null = null;
    try {
      parsed = await parseImportFile({
        sourceType,
        text,
        buffer,
        mapping: parseClientMapping(formData.get("mapping")),
        patterns: getRuleset(projectId).requirementIdPatterns
      });
    } catch (error) {
      failure = describeImportFailure(sourceType, error);
    }

    const rawErrors = parsed?.errors ?? [];
    // Save, bookkeeping, and re-analysis commit together, so a failure leaves the project as it was.
    const { saved, recordCount, status, explanation, messages, findingCount } = runImportTransaction(() => {
      // Nothing is saved for an empty file, so it can never offer to remove every record.
      const saved: SaveParsedResult | null =
        parsed && parsed.records.length > 0 ? saveParsedImport(projectId, parsed) : null;
      const recordCount = saved?.recordCount ?? 0;
      const status: ImportStatus = failure ? "failed" : recordCount > 0 ? "imported" : "empty";
      const explanation =
        failure ??
        (status === "empty"
          ? describeEmptyImport(sourceType, rawErrors, isCsvImportType(sourceType) ? csvDataRows(text) : undefined)
          : null);
      // When nothing was imported, the explanation already covers missing columns.
      const messages = [
        ...(decoded.warning ? [decoded.warning] : []),
        ...friendlyParserMessages(
          sourceType,
          status === "imported" ? rawErrors : rawErrors.filter((error) => !isMissingColumnError(error))
        )
      ];

      addImportBatch(
        projectId,
        sourceType,
        file.name,
        recordCount,
        explanation ? [explanation.message, ...messages] : messages
      );
      recordAuditEvent({
        projectId,
        action: "import.completed",
        actor: auditActor(),
        summary: auditSummary(status, recordCount, file.name, sourceType),
        details: {
          sourceType,
          filename: file.name,
          status,
          recordCount,
          createdCount: saved?.createdCount ?? 0,
          updatedCount: saved?.updatedCount ?? 0,
          linkCount: saved?.linkCount ?? 0,
          errorCount: messages.length
        }
      });
      const findingCount = recordCount > 0 ? rerunAnalysis(projectId).length : getFindings(projectId).length;
      return { saved, recordCount, status, explanation, messages, findingCount };
    });
    const entityType = importTypeInfo(sourceType).entityType;

    const body: ImportResponse = {
      status,
      sourceType,
      entityType,
      filename: file.name,
      recordCount,
      createdCount: saved?.createdCount ?? 0,
      updatedCount: saved?.updatedCount ?? 0,
      linkCount: saved?.linkCount ?? 0,
      findingCount,
      message: explanation?.message,
      detail: explanation?.detail,
      errors: messages,
      missing: saved ? summarizeMissing(entityType, saved.missingExternalIds, recordCount) : null
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Doorframe import failed:", error);
    return errorResponse(500, {
      error: "The import could not be completed because the local database reported an error. Try again; if it keeps happening, check the server log.",
      detail: error instanceof Error ? error.message : undefined
    });
  }
}
