import { Route, Routes } from "react-router-dom";

import { Codex } from "./screens/Codex";
import { GameScreen } from "./screens/GameScreen";
import { HowToPlay } from "./screens/HowToPlay";
import { Leaderboard } from "./screens/Leaderboard";
import { MainMenu } from "./screens/MainMenu";

/** Top-level router. Screens are added here as they are built. */
export function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/play" element={<GameScreen />} />
        <Route path="/how-to-play" element={<HowToPlay />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </div>
  );
}
