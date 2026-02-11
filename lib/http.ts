// FILE: lib/http.ts
export class HttpError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 15000, ...rest } = init;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(rest.headers || {}),
      },
    });

    const ct = res.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");

    const body = isJson
      ? await res.json().catch(() => undefined)
      : await res.text().catch(() => undefined);

    if (!res.ok) {
      throw new HttpError(`HTTP ${res.status} for ${url}`, res.status, body);
    }

    return body as T;
  } finally {
    clearTimeout(t);
  }
}