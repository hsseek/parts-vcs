import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

const BASE = import.meta.env.VITE_API_BASE ?? "";
const SLOTS = ["isometric", "front", "right", "top"];

function ImageCard({ src, label, onReplace, onDelete, onRename }) {
  const [hovered, setHovered] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(label);
  const isEmpty = !src;

  const commitRename = () => {
    const trimmed = labelValue.trim();
    if (trimmed && trimmed !== label) onRename(trimmed);
    else setLabelValue(label);
    setEditingLabel(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={isEmpty ? onReplace : undefined}
        style={{
          position: "relative", width: 80, height: 80,
          border: isEmpty ? "1.5px dashed var(--border)" : "1px solid var(--border)",
          borderRadius: 6, background: "var(--surface2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", cursor: isEmpty ? "pointer" : "default", flexShrink: 0,
        }}
      >
        {src
          ? <img src={`${BASE}${src}`} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
          : <span style={{ fontSize: 22, color: "var(--text-dim)" }}>+</span>
        }
        {hovered && src && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            <button
              onClick={e => { e.stopPropagation(); onReplace(); }}
              style={{
                background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)",
                borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "var(--font-mono)",
              }}
            >Replace</button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{
                background: "transparent", color: "#f87171", border: "1px solid #f87171",
                borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "var(--font-mono)",
              }}
            >Delete</button>
          </div>
        )}
      </div>
      {onRename && editingLabel ? (
        <input
          value={labelValue}
          onChange={e => setLabelValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setLabelValue(label); setEditingLabel(false); }
          }}
          autoFocus
          style={{ fontSize: 9, width: 80, padding: "1px 4px", fontFamily: "var(--font-mono)", textAlign: "center" }}
        />
      ) : (
        <span
          onClick={onRename ? () => { setLabelValue(label); setEditingLabel(true); } : undefined}
          title={onRename ? "Click to rename" : undefined}
          style={{
            fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--font-mono)",
            maxWidth: 80, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap",
            cursor: onRename ? "text" : "default",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function VersionRow({ version, onRelease, onUnrelease, onRefetchImages, onRefresh, refreshing }) {
  const [notes, setNotes] = useState(version.release_notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const fileInputRef = useRef(null);
  const pendingUpload = useRef(null);

  const handleRefetch = async () => {
    setRefetching(true);
    try { await onRefetchImages(version.id); } finally { setRefetching(false); }
  };

  const saveNotes = async () => {
    setSaving(true);
    await api.updateNotes(version.id, notes);
    setSaving(false);
    setEditingNotes(false);
  };

  const triggerUpload = (pending) => {
    pendingUpload.current = pending;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !pendingUpload.current) return;
    const pending = pendingUpload.current;
    const fd = new FormData();
    fd.append("file", file);
    if (pending.type === "slot") {
      fd.append("slot", pending.slot);
    } else if (pending.type === "custom_replace") {
      try { await api.deleteCustomImage(pending.imageId); } catch (err) { console.error("remove old custom image:", err); }
      fd.append("label", pending.label || "");
    } else {
      fd.append("label", pending.label || "");
    }
    setUploading(true);
    try {
      await api.uploadVersionImage(version.id, fd);
      onRefresh();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const deleteSlot = async (slot) => {
    setUploading(true);
    try { await api.deleteVersionSlot(version.id, slot); onRefresh(); }
    catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  const deleteCustom = async (imageId) => {
    setUploading(true);
    try { await api.deleteCustomImage(imageId); onRefresh(); }
    catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  const renameCustom = async (imageId, newLabel) => {
    try { await api.renameCustomImage(imageId, newLabel); onRefresh(); }
    catch (err) { console.error(err); }
  };

  const addNewImage = () => {
    const defaultLabel = `Image ${(version.custom_images?.length ?? 0) + 1}`;
    triggerUpload({ type: "new", label: newLabel.trim() || defaultLabel });
    setShowAddForm(false);
    setNewLabel("");
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${version.is_released ? "rgba(78,222,128,0.3)" : "var(--border)"}`,
      borderRadius: 8, padding: "16px 20px",
      display: "grid", gridTemplateColumns: "1fr auto",
      gap: 16, alignItems: "start",
    }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

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
          {version.is_released && !version.images_fetched && (
            <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginRight: 5 }} />
              fetching images…
            </span>
          )}
          {version.is_released && version.images_fetched && (
            <button
              onClick={handleRefetch}
              disabled={refetching}
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-mono)", padding: 0 }}
            >
              {refetching ? "re-fetching…" : "↺ re-fetch images"}
            </button>
          )}
          {uploading && <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>uploading…</span>}
        </div>

        {/* Images */}
        {version.is_released && (
          <div style={{ marginBottom: 12 }}>
            {/* Standard slots */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              {SLOTS.map(slot => (
                <ImageCard
                  key={slot}
                  src={version[`img_${slot}`]}
                  label={slot}
                  onReplace={() => triggerUpload({ type: "slot", slot })}
                  onDelete={() => deleteSlot(slot)}
                />
              ))}
            </div>

            {/* Custom images */}
            {version.custom_images?.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                {version.custom_images.map(img => (
                  <ImageCard
                    key={img.id}
                    src={img.path}
                    label={img.label}
                    onReplace={() => triggerUpload({ type: "custom_replace", imageId: img.id, label: img.label })}
                    onDelete={() => deleteCustom(img.id)}
                    onRename={(newLabel) => renameCustom(img.id, newLabel)}
                  />
                ))}
              </div>
            )}

            {/* Add image */}
            {showAddForm ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder={`Image ${(version.custom_images?.length ?? 0) + 1}`}
                  style={{ width: 160, fontSize: 12, padding: "5px 8px" }}
                  onKeyDown={e => {
                    if (e.key === "Enter") addNewImage();
                    if (e.key === "Escape") { setShowAddForm(false); setNewLabel(""); }
                  }}
                  autoFocus
                />
                <button className="btn-primary" onClick={addNewImage} style={{ fontSize: 12, padding: "5px 12px" }}>
                  Choose file
                </button>
                <button className="btn-ghost" onClick={() => { setShowAddForm(false); setNewLabel(""); }} style={{ fontSize: 12, padding: "5px 12px" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="btn-ghost"
                onClick={() => setShowAddForm(true)}
                disabled={uploading}
                style={{ fontSize: 11, padding: "4px 10px", marginTop: 2 }}
              >
                + Add image
              </button>
            )}
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
                border: "1px solid transparent", transition: "border-color 0.15s",
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
          <button className="btn-primary" onClick={() => onRelease(version.id, notes)} disabled={refreshing}>
            ✓ Mark Released
          </button>
        ) : (
          <button className="btn-danger" onClick={() => onUnrelease(version.id)} disabled={refreshing}>
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
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, v] = await Promise.all([api.getPart(id), api.listVersions(id, false)]);
      setPart(p); setVersions(v);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const pending = versions.some(v => v.is_released && !v.images_fetched);
    if (!pending) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [versions, load]);

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

  const saveName = async () => {
    if (!nameValue.trim()) return;
    setSavingName(true);
    try {
      await api.updatePart(id, { name: nameValue.trim() });
      await load();
      setEditingName(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingName(false);
    }
  };

  const onRelease = async (versionId) => { await api.releasePart(versionId); await load(); };
  const onUnrelease = async (versionId) => { await api.unrelease(versionId); await load(); };
  const onRefetchImages = async (versionId) => { await api.refetchImages(versionId); await load(); };

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
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", padding: "4px 8px", minWidth: 240 }}
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                autoFocus
              />
              <button className="btn-primary" onClick={saveName} disabled={savingName} style={{ padding: "6px 14px" }}>
                {savingName ? "…" : "Save"}
              </button>
              <button className="btn-ghost" onClick={() => setEditingName(false)} style={{ padding: "6px 14px" }}>
                Cancel
              </button>
            </div>
          ) : (
            <h1
              onClick={() => { setNameValue(part.name); setEditingName(true); }}
              title="Click to rename"
              style={{
                fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4,
                cursor: "pointer", display: "inline-block",
                borderBottom: "1px dashed transparent", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderBottomColor = "var(--border)"}
              onMouseLeave={e => e.currentTarget.style.borderBottomColor = "transparent"}
            >{part.name}</h1>
          )}
          {part.description && !editingName && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{part.description}</p>
          )}
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

      <div style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 6, padding: "10px 14px", marginBottom: 28,
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", wordBreak: "break-all",
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
              <VersionRow key={v.id} version={v}
                onRelease={onRelease} onUnrelease={onUnrelease}
                onRefetchImages={onRefetchImages} onRefresh={load}
              />
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
              <VersionRow key={v.id} version={v}
                onRelease={onRelease} onUnrelease={onUnrelease}
                onRefetchImages={onRefetchImages} onRefresh={load}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
