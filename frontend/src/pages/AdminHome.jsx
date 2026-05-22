import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function AdminHome() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchedParts, setFetchedParts] = useState([]);
  const [importNames, setImportNames] = useState({});
  const [importChecked, setImportChecked] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const load = () => {
    api.listParts()
      .then(setParts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const syncAll = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await api.syncAll();
      const total = res.results.reduce((s, r) => s + r.new_versions, 0);
      setSyncMsg(`Sync complete — ${total} new CalVer version(s) detected.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const openAddPanel = () => {
    setShowAddPanel(true);
    setUrlInput("");
    setFetchError(null);
    setFetchedParts([]);
    setImportNames({});
    setImportChecked(new Set());
  };

  const closeAddPanel = () => {
    setShowAddPanel(false);
    setUrlInput("");
    setFetchError(null);
    setFetchedParts([]);
  };

  const fetchByUrl = async () => {
    if (!urlInput.trim()) return;
    setFetching(true);
    setFetchError(null);
    setFetchedParts([]);
    try {
      const res = await api.discoverByUrl(urlInput.trim());
      const parts = res.parts ?? [];
      setFetchedParts(parts);
      const names = {};
      const checked = new Set();
      parts.forEach((p, i) => {
        names[i] = p.suggested_name;
        checked.add(i);
      });
      setImportNames(names);
      setImportChecked(checked);
    } catch (e) {
      setFetchError(e.message);
    } finally {
      setFetching(false);
    }
  };

  const toggleCheck = (i) => {
    setImportChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const doImport = async () => {
    const items = [...importChecked].map(i => ({
      name: importNames[i] || fetchedParts[i].suggested_name,
      document_id: fetchedParts[i].document_id,
      element_id: fetchedParts[i].element_id,
      element_type: fetchedParts[i].element_type,
    }));
    if (!items.length) return;
    setImporting(true);
    try {
      const res = await api.importParts(items);
      setSyncMsg(`Imported ${res.created} part(s).`);
      closeAddPanel();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>Admin</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Manage parts and approve versions for field staff.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={showAddPanel ? closeAddPanel : openAddPanel}>
            {showAddPanel ? "Cancel" : "+ Add Part"}
          </button>
          <button className="btn-primary" onClick={syncAll} disabled={syncing}>
            {syncing ? <><span className="spinner" /> Syncing…</> : "↺ Sync All from Onshape"}
          </button>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
      {syncMsg && (
        <div style={{
          background: "rgba(78,222,128,0.08)", border: "1px solid rgba(78,222,128,0.25)",
          color: "var(--green)", padding: "10px 14px", borderRadius: 6,
          fontSize: 13, marginBottom: 16,
        }}>{syncMsg}</div>
      )}

      {showAddPanel && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 24, marginBottom: 28,
        }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 14, letterSpacing: "0.05em" }}>
            ADD PART
          </h3>

          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchByUrl()}
              placeholder="https://cad.onshape.com/documents/…"
              style={{ flex: 1 }}
              autoFocus
            />
            <button className="btn-ghost" onClick={fetchByUrl} disabled={fetching || !urlInput.trim()}>
              {fetching ? <><span className="spinner" /> Fetching…</> : "Fetch"}
            </button>
          </div>

          {fetchError && (
            <div className="error-msg" style={{ marginBottom: 12 }}>{fetchError}</div>
          )}

          {fetchedParts.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, marginTop: 8 }}>
                {fetchedParts.length} part(s) found. Edit names before importing.{" "}
                <button
                  onClick={() => {
                    if (importChecked.size === fetchedParts.length) {
                      setImportChecked(new Set());
                    } else {
                      setImportChecked(new Set(fetchedParts.map((_, i) => i)));
                    }
                  }}
                  style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}
                >
                  {importChecked.size === fetchedParts.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <button
                  className="btn-primary"
                  onClick={doImport}
                  disabled={importing || importChecked.size === 0}
                >
                  {importing ? <><span className="spinner" /> Importing…</> : `Import ${importChecked.size} Selected`}
                </button>
                <button className="btn-ghost" onClick={closeAddPanel}>Cancel</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fetchedParts.map((item, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12, alignItems: "center",
                    padding: "10px 14px",
                    background: importChecked.has(i) ? "var(--surface2)" : "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    opacity: importChecked.has(i) ? 1 : 0.5,
                  }}>
                    <input
                      type="checkbox"
                      checked={importChecked.has(i)}
                      onChange={() => toggleCheck(i)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <input
                      value={importNames[i] ?? item.suggested_name}
                      onChange={e => setImportNames(n => ({ ...n, [i]: e.target.value }))}
                      style={{ fontWeight: 600, fontSize: 14 }}
                    />
                    <span style={{
                      fontSize: 11, fontFamily: "var(--font-mono)",
                      padding: "2px 6px", borderRadius: 3,
                      background: "var(--surface2)", color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}>
                      {item.element_name}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!fetching && fetchedParts.length === 0 && !fetchError && (
            <div style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={closeAddPanel}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {loading && <div style={{ color: "var(--text-muted)" }}><span className="spinner" /> Loading…</div>}

      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {parts.map(part => (
            <Link key={part.id} to={`/admin/part/${part.id}`}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "14px 18px",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 3 }}>{part.name}</div>
                {part.description && (
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{part.description}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                {part.latest_version
                  ? <div className="tag tag-released" style={{ marginBottom: 4 }}>{part.latest_version}</div>
                  : <div className="tag" style={{ marginBottom: 4 }}>No release</div>
                }
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  {part.released_count} released
                </div>
              </div>
              <span style={{ color: "var(--text-dim)", fontSize: 18 }}>›</span>
            </Link>
          ))}
          {parts.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)",
                          border: "1px dashed var(--border)", borderRadius: 10 }}>
              No parts yet. Add one above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
