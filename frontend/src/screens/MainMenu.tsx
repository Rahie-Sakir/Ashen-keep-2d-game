/** Title screen: name entry (sign-in) and navigation into the game/site. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSession } from "../session";

export function MainMenu() {
  const { player, online, signIn, signOut } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the keep.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--center menu">
      <h1 className="title">SOULSFAN GAMES</h1>
      <p className="subtitle">THREE LEVEL BROWSER CHALLENGE</p>

      {!player ? (
        <form className="namecard" onSubmit={handleSignIn}>
          <label htmlFor="name">Choose a player name to begin</label>
          <input
            id="name"
            value={name}
            maxLength={24}
            placeholder="Player name"
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn--primary" disabled={busy || name.trim().length < 2}>
            {busy ? "ENTERING…" : "ENTER"}
          </button>
          {!online && <p className="hint hint--warn">Backend offline — progress will not be saved.</p>}
          {error && <p className="hint hint--warn">{error}</p>}
        </form>
      ) : (
        <nav className="menu-buttons">
          <p className="welcome">
            Welcome, <strong>{player.name}</strong>.
          </p>
          <button className="btn btn--primary" onClick={() => navigate("/play")}>
            PLAY
          </button>
          <button className="btn" onClick={() => navigate("/codex")}>
            GAME CODEX
          </button>
          <button className="btn" onClick={() => navigate("/how-to-play")}>
            COMBAT MANUAL
          </button>
          <button className="btn" onClick={() => navigate("/leaderboard")}>
            LEADERBOARD
          </button>
          <button className="btn btn--ghost" onClick={signOut}>
            SIGN OUT
          </button>
        </nav>
      )}

      <footer className="menu-footer">Beat all three levels and rank by finish time.</footer>
    </main>
  );
}
