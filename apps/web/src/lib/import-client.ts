import {
  FILE_CHANGED_MESSAGE,
  SERVER_UNREACHABLE_MESSAGE,
  unexpectedResponseMessage,
  type FailureDescription
} from "./import-messages";
import type {
  ColumnMapping,
  ImportEntityType,
  ImportPreviewResponse,
  ImportResponse,
  ImportSourceType,
  RemoveRecordsResponse
} from "./import-types";

/**
 * Browser helpers for the imports page. Every request resolves to an outcome
 * instead of throwing, so the page can always leave its busy state.
 */

export type RequestOutcome<T> = { ok: true; data: T } | { ok: false; failure: FailureDescription };

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function errorBody(body: unknown): FailureDescription | null {
  if (!body || typeof body !== "object" || typeof (body as { error?: unknown }).error !== "string") {
    return null;
  }

  const { error, detail } = body as { error: string; detail?: unknown };
  return { message: error, detail: typeof detail === "string" ? detail : undefined };
}

/** POST and read a JSON body defensively: network errors and non-JSON bodies become plain messages. */
export async function requestJson<T>(url: string, init: RequestInit, fetcher: Fetcher = fetch): Promise<RequestOutcome<T>> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch {
    return { ok: false, failure: { message: SERVER_UNREACHABLE_MESSAGE } };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    return { ok: false, failure: errorBody(body) ?? { message: unexpectedResponseMessage(response.status) } };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, failure: { message: unexpectedResponseMessage(response.status) } };
  }

  return { ok: true, data: body as T };
}

/**
 * Copy the chosen file into memory before uploading. Browsers refuse to read a
 * file that changed on disk after it was chosen; catching that here gives a
 * clear message instead of a failed upload. Returns null in that case.
 */
export async function readFileCopy(file: Blob): Promise<Blob | null> {
  try {
    const bytes = await file.arrayBuffer();
    return new Blob([bytes], { type: file.type });
  } catch {
    return null;
  }
}

async function uploadFile<T>(
  url: string,
  fields: Record<string, string>,
  file: File,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch
): Promise<RequestOutcome<T>> {
  const copy = await readFileCopy(file);
  if (!copy) {
    return { ok: false, failure: { message: FILE_CHANGED_MESSAGE } };
  }

  const form = new FormData();
  Object.entries(fields).forEach(([name, value]) => form.set(name, value));
  form.set("file", copy, file.name);
  return requestJson<T>(url, { method: "POST", body: form, signal }, fetcher);
}

function projectApi(projectId: string, path: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/${path}`;
}

export function requestPreview(
  projectId: string,
  sourceType: ImportSourceType,
  file: File,
  signal?: AbortSignal
): Promise<RequestOutcome<ImportPreviewResponse>> {
  return uploadFile(projectApi(projectId, "import/preview"), { sourceType }, file, signal);
}

export function requestImport(
  projectId: string,
  sourceType: ImportSourceType,
  file: File,
  mapping: ColumnMapping | null
): Promise<RequestOutcome<ImportResponse>> {
  const fields: Record<string, string> = { sourceType };
  if (mapping) {
    fields.mapping = JSON.stringify(mapping);
  }

  return uploadFile(projectApi(projectId, "import"), fields, file);
}

export function requestRemoveRecords(
  projectId: string,
  entityType: ImportEntityType,
  externalIds: string[]
): Promise<RequestOutcome<RemoveRecordsResponse>> {
  return requestJson(projectApi(projectId, "records/remove"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityType, externalIds })
  });
}
