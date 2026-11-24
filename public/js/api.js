// One entry point for data. Normally it calls the Express server; the static GitHub Pages
// build sets window.FARESCOPE_STATIC and the same logic runs in the browser instead.
let backend;

export async function api(path, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]));
  if (window.FARESCOPE_STATIC) {
    backend ??= import('./backend.js');
    return (await backend).handle(path, clean);
  }
  const qs = new URLSearchParams(clean).toString();
  const res = await fetch(`api/${path}${qs ? `?${qs}` : ''}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
