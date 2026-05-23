import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import StaffHome from "./pages/StaffHome";
import PartView from "./pages/PartView";
import AdminHome from "./pages/AdminHome";
import AdminPart from "./pages/AdminPart";
import { api } from "./api/client";
import "./index.css";

function Nav() {
  return (
    <nav style={{
      display: "flex", alignItems: "center",
      padding: "14px 28px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontWeight: 700,
          fontSize: 13, letterSpacing: "0.12em",
          background: "var(--accent)", color: "#0f0f0f",
          padding: "2px 8px", borderRadius: 3,
        }}>VCS</span>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.04em" }}>
          PartVCS
        </span>
      </Link>
    </nav>
  );
}

function AdminLogin({ onAuthed }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(pass);
      localStorage.setItem("admin_token", res.token);
      onAuthed();
    } catch {
      setError("Incorrect passphrase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "60vh",
    }}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, width: 260 }}>
        <input
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          placeholder="••••••••"
          autoFocus
          style={{ fontSize: 16, letterSpacing: "0.2em", textAlign: "center" }}
        />
        {error && (
          <div style={{ fontSize: 12, color: "#f87171", textAlign: "center", fontFamily: "var(--font-mono)" }}>
            {error}
          </div>
        )}
        <button className="btn-primary" type="submit" disabled={loading || !pass}>
          {loading ? <span className="spinner" /> : "→"}
        </button>
      </form>
    </div>
  );
}

function AdminGuard({ children }) {
  const [state, setState] = useState("checking"); // "checking" | "authed" | "login"

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const check = token
      ? api.checkAuth().then(() => "authed").catch(() => { localStorage.removeItem("admin_token"); return "login"; })
      : Promise.resolve("login");
    check.then(s => setState(s));

    const onExpired = () => setState("login");
    window.addEventListener("admin-session-expired", onExpired);
    return () => window.removeEventListener("admin-session-expired", onExpired);
  }, []);

  if (state === "checking") return <div style={{ padding: 40 }}><span className="spinner" /></div>;
  if (state === "login") return <AdminLogin onAuthed={() => setState("authed")} />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<StaffHome />} />
        <Route path="/part/:id" element={<PartView />} />
        <Route path="/admin" element={<AdminGuard><AdminHome /></AdminGuard>} />
        <Route path="/admin/part/:id" element={<AdminGuard><AdminPart /></AdminGuard>} />
      </Routes>
    </BrowserRouter>
  );
}
