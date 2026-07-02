import { useEffect, useState } from "react";

import { api, type Score } from "../api";
import { TopBar } from "./TopBar";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Leaderboard() {
  const [scores, setScores] = useState<Score[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLeaderboard(25)
      .then(setScores)
      .catch((e) => setError(e instanceof Error ? e.message : "Offline"));
  }, []);

  return (
    <div className="page" style={{ padding: "0 1rem 3rem" }}>
      <TopBar title="LEADERBOARD" />
      <section style={{ padding: "1.2rem 0" }}>
        {error && <p className="hint hint--warn">Leaderboard unavailable: {error}</p>}
        {!error && !scores && <p>Loading fastest runs...</p>}
        {scores && scores.length === 0 && <p>No completed runs recorded yet. Be the first.</p>}
        {scores && scores.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Finish Time</th>
                <th>Level</th>
                <th>Echoes</th>
                <th>Cleared</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score, index) => (
                <tr key={score.id}>
                  <td>{index + 1}</td>
                  <td style={{ color: "var(--ember)" }}>{score.name}</td>
                  <td>{formatTime(score.timeSeconds)}</td>
                  <td>{score.levelReached}</td>
                  <td>{score.echoes}</td>
                  <td>{score.victory ? "YES" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
