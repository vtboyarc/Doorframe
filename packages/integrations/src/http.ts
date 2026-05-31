/**
 * Minimal HTTP response surface used by all connectors. Mirrors the parts of the
 * Fetch `Response` we rely on so connectors can be unit-tested with a mock.
 */
export interface HttpResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
}

export interface HttpRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/** Injectable HTTP client. Defaults to the global `fetch`. */
export type HttpClient = (url: string, init?: HttpRequestInit) => Promise<HttpResponse>;

export const defaultHttpClient: HttpClient = async (url, init) => {
  const response = await fetch(url, init as RequestInit);
  return {
    status: response.status,
    ok: response.ok,
    text: () => response.text()
  };
};

export function basicAuthHeader(user: string, secret: string): string {
  const token = Buffer.from(`${user}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

export async function getJson<T>(http: HttpClient, url: string, headers: Record<string, string>): Promise<T> {
  const response = await http(url, { method: "GET", headers });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}: ${body.slice(0, 200)}`);
  }
  return JSON.parse(body) as T;
}
