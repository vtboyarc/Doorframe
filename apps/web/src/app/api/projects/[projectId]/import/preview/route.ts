import { NextResponse } from "next/server";
import { decodeUpload } from "@/lib/import-encoding";
import {
  detectNonCommaDelimiter,
  inferJiraCsvMapping,
  inferRequirementsCsvMapping,
  readCsvPreview,
  type CsvPreview
} from "@doorframe/parsers";
import { getProject } from "@/lib/db";
import { delimiterMessage, describeImportFailure, fileTooLargeMessage, NO_CSV_ROWS_MESSAGE } from "@/lib/import-messages";
import {
  completeMapping,
  isCsvImportType,
  isImportSourceType,
  mappingFieldsFor,
  MAX_IMPORT_FILE_BYTES,
  type ImportErrorResponse,
  type ImportPreviewResponse
} from "@/lib/import-types";

export const runtime = "nodejs";

const PREVIEW_ROWS = 5;
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

function errorResponse(status: number, body: ImportErrorResponse) {
  return NextResponse.json(body, { status });
}

/**
 * Inspect an uploaded CSV with the importer's own CSV settings: return its
 * headers, the first rows, the row count, and the column mapping the importer
 * infers, so the form shows exactly what the import will use.
 */
export const POST = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
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
  if (!isImportSourceType(sourceType) || !isCsvImportType(sourceType)) {
    return errorResponse(400, { error: "Previews are available for Requirements CSV and Jira CSV imports." });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, { error: "Choose a file to preview." });
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return errorResponse(413, { error: fileTooLargeMessage(file.size) });
  }

  let preview: CsvPreview;
  try {
    preview = readCsvPreview(decodeUpload(new Uint8Array(await file.arrayBuffer())).text, PREVIEW_ROWS);
  } catch (error) {
    const failure = describeImportFailure(sourceType, error);
    return errorResponse(422, { error: failure.message, detail: failure.detail });
  }

  if (preview.headers.length === 0) {
    return errorResponse(422, { error: NO_CSV_ROWS_MESSAGE });
  }

  const delimiter = detectNonCommaDelimiter(preview.headers);
  if (delimiter) {
    return errorResponse(422, { error: delimiterMessage(delimiter) });
  }

  const inferred =
    sourceType === "jira-csv" ? inferJiraCsvMapping(preview.headers) : inferRequirementsCsvMapping(preview.headers);
  const body: ImportPreviewResponse = {
    headers: preview.headers,
    rows: preview.rows,
    totalRows: preview.totalRows,
    mapping: completeMapping(mappingFieldsFor(sourceType), inferred as Record<string, string | undefined>)
  };

  return NextResponse.json(body);
};
