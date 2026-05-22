import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function AdminHome() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  // Import from Onshape state
  const [showImport, setShowImport] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState(null);
  const [importNames, setImportNames] = useState({});
  const [importChecked, setImportChecked] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "",
    onshape_document_id: "", onshape_element_id: "",
    onshape_element_type: "partstudio",
  });

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

  const startDiscover = async () => {
    setShowImport(true);
    setDiscovered(null);
    setDiscovering(true);
    setError(null);
    try {
      const results = await api.discoverParts();
      setDiscovered(results);
      const names = {};
      const checked = new Set();
      results.forEach((item, i) => {
        names[i] = item.element_name;
        checked.add(i);
      });
      setImportNames(names);
      setImportChecked(checked);
    } catch (e) {
      setError(e.message);
      setShowImport(false);
    } finally {
      setDiscovering(false);
    }
  };

  const toggleImportCheck = (i) => {
    setImportChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const doImport = async () => {
    const items = [...importChecked].map(i => ({
      name: importNames[i] || discovered[i].element_name,
      document_id: discovered[i].document_id,
      element_id: discovered[i].element_id,
      element_type: discovered[i].element_type,
    }));
    if (!items.length) return;
    setImporting(true);
    try {
      const res = await api.importParts(items);
      setSyncMsg(`Imported ${res.created} part(s) from Onshape.`);
      setShowImport(false);
      setDiscovered(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const addPart = async () => {
    if (!form.name || !form.onshape_document_id || !form.onshape_element_id) return;
    try {
      await api.createPart(form);
      setForm({ name: "", description: "", onshape_document_id: "", onshape_element_id: "", onshape_element_type: "partstudio" });
      setShowAddForm(false);
      load();
    } catch (e) {
      setError(e.message);
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
          <button className="btn-ghost" onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? "Cancel" : "+ Add Part"}
          </button>
          <button className="btn-ghost" onClick={startDiscover} disabled={discovering}>
            {discovering ? <><span className="spinner" /> Scanning…</> : "⬇ Import from Onshape"}
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

      {/* Add part form */}
      {showAddForm && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 24, marginBottom: 28,
        }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 14, letterSpacing: "0.05em" }}>
            NEW PART
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(s => ({...s, name: e.target.value}))} placeholder="Mounting Bracket v2" />
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <input value={form.description} onChange={e => setForm(s => ({...s, description: e.target.value}))} placeholder="Front panel bracket" />
            </div>
            <div className="field">
              <label>Onshape Document ID</label>
              <input value={form.onshape_document_id} onChange={e => setForm(s => ({...s, onshape_document_id: e.target.value}))} placeholder="24-char ID from URL" style={{ fontFamily: "var(--font-mono)" }} />
            </div>
            <div className="field">
              <label>Onshape Element ID</label>
              <input value={form.onshape_element_id} onChange={e => setForm(s => ({...s, onshape_element_id: e.target.value}))} placeholder="24-char element ID" style={{ fontFamily: "var(--font-mono)" }} />
            </div>
            <div className="field">
              <label>Element Type</label>
              <select value={form.onshape_element_type} onChange={e => setForm(s => ({...s, onshape_element_type: e.target.value}))}>
                <option value="partstudio">Part Studio</option>
                <option value="assembly">Assembly</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 8, padding: "10px 14px", background: "var(--surface2)", borderRadius: 6, fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Find IDs in the Onshape URL: .../documents/<b>{'<document_id>'}</b>/w/…/e/<b>{'<element_id>'}</b>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={addPart}>Add Part</button>
            <button className="btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Import from Onshape panel */}
      {showImport && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 24, marginBottom: 28,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.05em" }}>
              IMPORT FROM ONSHAPE
            </h3>
            <button className="btn-ghost" onClick={() => setShowImport(false)} style={{ padding: "4px 10px" }}>✕</button>
          </div>

          {discovering && (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              <span className="spinner" /> Scanning your Onshape documents (up to 20 recent)…
            </div>
          )}

          {discovered && discovered.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              No new Part Studio or Assembly elements found. All discovered elements are already in this project.
            </p>
          )}

          {discovered && discovered.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                {discovered.length} new element(s) found. Edit names before importing.
                Elements with 0 CalVer versions can be imported — sync them after.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {discovered.map((item, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
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
                      onChange={() => toggleImportCheck(i)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <input
                      value={importNames[i] ?? item.element_name}
                      onChange={e => setImportNames(n => ({ ...n, [i]: e.target.value }))}
                      style={{ fontWeight: 600, fontSize: 14 }}
                    />
                    <span style={{
                      fontSize: 11, fontFamily: "var(--font-mono)",
                      padding: "2px 6px", borderRadius: 3,
                      background: "var(--surface2)", color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}>
                      {item.element_type}
                    </span>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ fontFamily: "var(--font-mono)" }}>{item.document_name}</div>
                      <div>{item.calver_count} CalVer version{item.calver_count !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={doImport}
                  disabled={importing || importChecked.size === 0}
                >
                  {importing ? <><span className="spinner" /> Importing…</> : `Import ${importChecked.size} Selected`}
                </button>
                <button className="btn-ghost" onClick={() => setShowImport(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && <div style={{ color: "var(--text-muted)" }}><span className="spinner" /> Loading…</div>}

      {/* Parts table */}
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
