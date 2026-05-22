import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

const BASE = import.meta.env.VITE_API_BASE ?? "";

function VersionRow({ version, onRelease, onUnrelease, refreshing }) {
  const [notes, setNotes] = useState(version.release_notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    setSaving(true);
    await api.updateNotes(version.id, notes);
    setSaving(false);
    setEditingNotes(false);
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${version.is_released ? "rgba(78,222,128,0.3)" : "var(--border)"}`,
      borderRadius: 8, padding: "16px 20px",
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 16, alignItems: "start",
    }}>
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700,
            color: version.is_released ? "var(--green)" : "var(--text)",
          }}>{version.version_name}</span>
          {version.is_released
            ? <span className="tag tag-released">Released</span>
            : <span className="tag">Pending</span>
          }
          {!version.images_fetched && version.is_released && (
            <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              ⏳ images fetching…
            </span>
          )}
        </div>

        {/* Thumbnail strip */}
        {version.is_released && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {["img_isometric", "img_front", "img_right", "img_top"].map(k => (
              version[k] ? (
                <img key={k} src={`${BASE}${version[k]}`} alt={k}
                  style={{
                    width: 72, height: 72, objectFit: "contain",
                    background: "var(--surface2)", borderRadius: 4, padding: 4,
                    border: "1px solid var(--border)",
                  }}
                />
              ) : null
            ))}
          </div>
        )}

        {/* Release notes */}
        {version.is_released && (
          editingNotes ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Describe key changes…"
                style={{ resize: "vertical" }}
              />
              <button className="btn-primary" onClick={saveNotes} disabled={saving} style={{ whiteSpace: "nowrap" }}>
                {saving ? "…" : "Save"}
              </button>
              <button className="btn-ghost" onClick={() => setEditingNotes(false)}>Cancel</button>
            </div>
          ) : (
            <div
              onClick={() => setEditingNotes(true)}
              style={{
                fontSize: 13, color: notes ? "var(--text-muted)" : "var(--text-dim)",
                cursor: "pointer", fontStyle: notes ? "normal" : "italic",
                padding: "6px 10px", borderRadius: 4,
                border: "1px solid transparent",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
            >
              {notes || "Click to add release notes…"}
            </div>
          )
        )}

        {version.released_at && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Released {new Date(version.released_at + "Z").toLocaleString()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 120, alignItems: "flex-end" }}>
        {!version.is_released ? (
          <button
            className="btn-primary"
            onClick={() => onRelease(version.id, notes)}
            disabled={refreshing}
          >
            ✓ Mark Released
          </button>
        ) : (
          <button
            className="btn-danger"
            onClick={() => onUnrelease(version.id)}
            disabled={refreshing}
          >
            Unrelease
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPart() {
  const { id } = useParams();
  const [part, setPart] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  const load = async () => {
    try {
      const [p, v] = await Promise.all([api.getPart(id), api.listVersions(id, false)]);
      setPart(p); setVersions(v);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const sync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await api.syncPart(id);
      setSyncMsg(`${res.synced} new version(s) found (${res.total_calver} CalVer total).`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const onRelease = async (versionId) => {
    await api.releasePart(versionId);
    await load();
  };

  const onUnrelease = async (versionId) => {
    await api.unrelease(versionId);
    await load();
  };

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)" }}><span className="spinner" /> Loading…</div>;
  if (error) return <div style={{ padding: 40 }}><div className="error-msg">{error}</div></div>;
  if (!part) return null;

  const released = versions.filter(v => v.is_released);
  const pending = versions.filter(v => !v.is_released);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        <Link to="/admin" style={{ color: "var(--text-muted)" }}>Admin</Link>
        <span> / </span>
        <span style={{ color: "var(--text)" }}>{part.name}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>{part.name}</h1>
          {part.description && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{part.description}</p>}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to={`/part/${id}`} className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", padding: "8px 16px" }}>
            Preview ↗
          </Link>
          <button className="btn-primary" onClick={sync} disabled={syncing}>
            {syncing ? <><span className="spinner" /> Syncing…</> : "↺ Sync from Onshape"}
          </button>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
      {syncMsg && (
        <div style={{
          background: "rgba(78,222,128,0.08)", border: "1px solid rgba(78,222,128,0.25)",
          color: "var(--green)", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 20,
        }}>{syncMsg}</div>
      )}

      {/* Onshape info */}
      <div style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 6, padding: "10px 14px", marginBottom: 28,
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)",
        wordBreak: "break-all",
      }}>
        doc: {part.onshape_document_id} · element: {part.onshape_element_id} · type: {part.onshape_element_type}
      </div>

      {/* Pending versions */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--text-muted)", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span>Pending Approval ({pending.length})</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map(v => (
              <VersionRow key={v.id} version={v} onRelease={onRelease} onUnrelease={onUnrelease} />
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && versions.length > 0 && (
        <div style={{
          marginBottom: 28, padding: "12px 16px",
          background: "rgba(78,222,128,0.06)", border: "1px solid rgba(78,222,128,0.2)",
          borderRadius: 6, fontSize: 13, color: "var(--green)",
        }}>
          All versions are released. Run sync to check for new ones.
        </div>
      )}

      {versions.length === 0 && (
        <div style={{
          textAlign: "center", padding: 48, color: "var(--text-muted)",
          border: "1px dashed var(--border)", borderRadius: 10, marginBottom: 28,
        }}>
          No CalVer versions detected. Name a version like <code style={{ fontFamily: "var(--font-mono)", background: "var(--surface2)", padding: "1px 6px", borderRadius: 3 }}>26.05.0</code> in Onshape, then sync.
        </div>
      )}

      {/* Released versions */}
      {released.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--text-muted)", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span>Released ({released.length})</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {released.map(v => (
              <VersionRow key={v.id} version={v} onRelease={onRelease} onUnrelease={onUnrelease} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
