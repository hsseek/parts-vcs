import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

const BASE = import.meta.env.VITE_API_BASE ?? "";

const VIEW_LABELS = {
  img_isometric: "Isometric",
  img_front: "Front",
  img_right: "Right",
  img_top: "Top",
};

function ImageGrid({ version }) {
  const stdViews = Object.entries(VIEW_LABELS)
    .filter(([k]) => version[k])
    .map(([k, label]) => ({ key: k, src: version[k], label }));
  const customViews = (version.custom_images ?? [])
    .map(img => ({ key: `ci_${img.id}`, src: img.path, label: img.label }));
  const views = [...stdViews, ...customViews];
  const [activeKey, setActiveKey] = useState(views[0]?.key ?? null);

  const active = views.find(v => v.key === activeKey) ?? views[0] ?? null;

  if (views.length === 0) {
    return (
      <div style={{
        height: 280, display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface2)", borderRadius: 8,
        color: "var(--text-dim)", fontSize: 12, fontFamily: "var(--font-mono)",
        flexDirection: "column", gap: 8,
      }}>
        <span>NO IMAGES</span>
        {!version.images_fetched && (
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
            Images fetching… refresh in a moment
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Main image */}
      <div style={{
        background: "var(--surface2)", borderRadius: 8,
        height: 280, display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", marginBottom: 10,
      }}>
        <img
          src={`${BASE}${active.src}`}
          alt={active.label}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 12 }}
        />
      </div>

      {/* View tabs */}
      {views.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {views.map(v => (
            <button
              key={v.key}
              onClick={() => setActiveKey(v.key)}
              style={{
                padding: "4px 12px", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase",
                background: activeKey === v.key ? "var(--accent)" : "var(--surface2)",
                color: activeKey === v.key ? "#0f0f0f" : "var(--text-muted)",
                border: `1px solid ${activeKey === v.key ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VersionCard({ version, isLatest }) {
  return (
    <div style={{
      border: `1px solid ${isLatest ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 10,
      overflow: "hidden",
      background: "var(--surface)",
      position: "relative",
    }}>
      {isLatest && (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 1,
          background: "var(--accent)", color: "#0f0f0f",
          fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
          padding: "2px 8px", borderRadius: 3, textTransform: "uppercase",
        }}>Current</div>
      )}
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700,
            color: isLatest ? "var(--accent)" : "var(--text)",
          }}>{version.version_name}</span>
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
            {version.released_at
              ? new Date(version.released_at + "Z").toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                })
              : "—"}
          </span>
        </div>

        <ImageGrid version={version} />

        {version.release_notes && (
          <div style={{
            marginTop: 14, padding: "10px 14px",
            background: "var(--surface2)", borderRadius: 6,
            fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6,
          }}>
            {version.release_notes}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartView() {
  const { id } = useParams();
  const [part, setPart] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getPart(id),
      api.listVersions(id, true), // released only
    ])
      .then(([p, v]) => { setPart(p); setVersions(v); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ padding: 40, color: "var(--text-muted)" }}>
      <span className="spinner" /> Loading…
    </div>
  );
  if (error) return <div style={{ padding: 40 }}><div className="error-msg">{error}</div></div>;
  if (!part) return null;

  const latest = versions[0];
  const older = versions.slice(1);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        <Link to="/" style={{ color: "var(--text-muted)" }}>Parts</Link>
        <span>/</span>
        <span style={{ color: "var(--text)" }}>{part.name}</span>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          {part.name}
        </h1>
        {part.description && (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{part.description}</p>
        )}
      </div>

      {versions.length === 0 ? (
        <div style={{ color: "var(--text-muted)", padding: 40, textAlign: "center",
                      border: "1px solid var(--border)", borderRadius: 10 }}>
          No released versions yet.
        </div>
      ) : (
        <>
          {/* Current version - prominent */}
          {latest && (
            <div style={{ marginBottom: 40 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12,
              }}>Current Approved Version</div>
              <VersionCard version={latest} isLatest={true} />
            </div>
          )}

          {/* Version history */}
          {older.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--text-muted)",
                marginBottom: 16,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span>Version History</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {older.map((v) => (
                  <VersionCard key={v.id} version={v} isLatest={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
