import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import StaffHome from "./pages/StaffHome";
import PartView from "./pages/PartView";
import AdminHome from "./pages/AdminHome";
import AdminPart from "./pages/AdminPart";
import "./index.css";

function Nav() {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith("/admin");
  return (
    <nav style={{
      display: "flex", alignItems: "center", gap: 24,
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
      <div style={{ flex: 1 }} />
      <Link to="/" style={{
        fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: !isAdmin ? "var(--accent)" : "var(--text-muted)",
        borderBottom: !isAdmin ? "1px solid var(--accent)" : "1px solid transparent",
        paddingBottom: 2,
      }}>Field</Link>
      <Link to="/admin" style={{
        fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: isAdmin ? "var(--accent)" : "var(--text-muted)",
        borderBottom: isAdmin ? "1px solid var(--accent)" : "1px solid transparent",
        paddingBottom: 2,
      }}>Admin</Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<StaffHome />} />
        <Route path="/part/:id" element={<PartView />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/part/:id" element={<AdminPart />} />
      </Routes>
    </BrowserRouter>
  );
}
