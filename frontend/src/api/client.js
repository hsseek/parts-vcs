const BASE = import.meta.env.VITE_API_BASE ?? "";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Parts
  listParts: () => req("GET", "/api/parts"),
  getPart: (id) => req("GET", `/api/parts/${id}`),
  createPart: (data) => req("POST", "/api/parts", data),
  updatePart: (id, data) => req("PATCH", `/api/parts/${id}`, data),
  deletePart: (id) => req("DELETE", `/api/parts/${id}`),

  // Versions
  listVersions: (partId, releasedOnly = false) =>
    req("GET", `/api/versions/part/${partId}?released_only=${releasedOnly}`),

  // Sync
  syncPart: (partId) => req("POST", `/api/sync/part/${partId}`),
  syncAll: () => req("POST", "/api/sync/all"),
  discoverParts: () => req("GET", "/api/sync/discover"),
  importParts: (items) => req("POST", "/api/sync/import", items),

  // Admin
  releasePart: (versionId, notes = "") =>
    req("POST", `/api/admin/release/${versionId}`, { release_notes: notes }),
  unrelease: (versionId) => req("POST", `/api/admin/unrelease/${versionId}`),
  updateNotes: (versionId, notes) =>
    req("PATCH", `/api/admin/version/${versionId}/notes`, { release_notes: notes }),
};
