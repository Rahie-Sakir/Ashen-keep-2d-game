import { useNavigate } from "react-router-dom";

/** Shared page header with a back-to-title link. */
export function TopBar({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <button className="link-btn" onClick={() => navigate("/")}>
        ← SOULSFAN GAMES
      </button>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <span style={{ width: 150 }} />
    </header>
  );
}
