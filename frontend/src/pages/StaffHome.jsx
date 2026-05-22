import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const BASE = import.meta.env.VITE_API_BASE ?? "";

export default function StaffHome() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listParts()
      .then(setParts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = parts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.latest_version ?? "").includes(search)
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
          Parts Reference
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Select a part to view current and historical versions.
        </p>
      </div>

      <input
        placeholder="Search parts or version…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 24, maxWidth: 360 }}
      />

      {loading && <div style={{ color: "var(--text-muted)" }}><span className="spinner" /> Loading…</div>}
      {error && <div className="error-msg">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>No parts found.</p>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 16,
      }}>
        {filtered.map((part) => (
          <Link key={part.id} to={`/part/${part.id}`}
            style={{
              display: "block",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              transition: "border-color 0.15s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* Thumbnail */}
            <div style={{
              height: 160,
              background: "var(--surface2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {part.latest_thumbnail ? (
                <img
                  src={`${BASE}${part.latest_thumbnail}`}
                  alt={part.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }}
                />
              ) : (
                <span style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                  NO IMAGE
                </span>
              )}
            </div>

            {/* Info */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{part.name}</div>
              {part.description && (
                <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 10 }}>
                  {part.description}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {part.latest_version ? (
                  <span className="tag tag-released">{part.latest_version}</span>
                ) : (
                  <span className="tag">No release</span>
                )}
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  {part.released_count} release{part.released_count !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
