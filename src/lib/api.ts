// One entry point for data. Normally it calls the Express server; the GitHub Pages build
// (VITE_STATIC=1) runs the same search code in the browser instead, with demo data only.
const STATIC = import.meta.env.VITE_STATIC === '1';
let backend: Promise<{ handle: (path: string, params: Record<string, string>) => Promise<unknown> }> | null = null;

export class ApiError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

export async function api<T>(path: string, params: object = {}): Promise<T> {
  const clean = Object.fromEntries(
    Object.entries(params as Record<string, unknown>)
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => [k, String(v)]),
  ) as Record<string, string>;
  if (STATIC) {
    // Plain JS module shared with the server, bundled only into the static build.
    backend ??= import('../../static/backend.js');
    try {
      return (await (await backend!).handle(path, clean)) as T;
    } catch (e) {
      throw new ApiError((e as Error).message || 'Something went wrong', 400);
    }
  }
  const qs = new URLSearchParams(clean).toString();
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api/${path}${qs ? `?${qs}` : ''}`);
  } catch {
    throw new ApiError("Can't reach the FareScope server. Is it running?");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  return body as T;
}
