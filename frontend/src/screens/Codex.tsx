import { ENEMY_STATS, BOSS_NAMES } from "../game/enemies";
import { WEAPONS } from "../game/weapons";
import { LEVELS } from "../game/levels";
import { TopBar } from "./TopBar";

export function Codex() {
  return (
    <div className="page" style={{ padding: "0 1rem 3rem" }}>
      <TopBar title="GAME CODEX" />

      <section style={{ padding: "1.2rem 0" }}>
        <h2>The Three Acts</h2>
        <table>
          <thead>
            <tr>
              <th>Act</th>
              <th>Guardian</th>
              <th>Mood</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((level) => (
              <tr key={level.id}>
                <td>{level.name}</td>
                <td style={{ color: "var(--ember)" }}>{BOSS_NAMES[level.bossId]}</td>
                <td style={{ fontStyle: "italic", color: "var(--paper-dim)" }}>{level.subtitle}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Armory</h2>
        <table>
          <thead>
            <tr>
              <th>Weapon</th>
              <th>Style</th>
              <th>Light dmg</th>
              <th>Heavy dmg</th>
              <th>Reach</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(WEAPONS).map((w) => (
              <tr key={w.id}>
                <td style={{ color: "var(--ember)" }}>{w.name}</td>
                <td>{w.style}</td>
                <td>{w.lightDamage}</td>
                <td>{w.heavyDamage}</td>
                <td>{w.heavyReach}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Bestiary</h2>
        <table>
          <thead>
            <tr>
              <th>Foe</th>
              <th>Health</th>
              <th>Damage</th>
              <th>Behavior</th>
              <th>Echoes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ENEMY_STATS).map(([kind, s]) => (
              <tr key={kind}>
                <td style={{ color: s.boss ? "var(--blood)" : "var(--paper)" }}>
                  {s.boss ? BOSS_NAMES[kind] : kind}
                </td>
                <td>{s.health}</td>
                <td>{s.damage}</td>
                <td>{s.behavior}</td>
                <td>{s.reward}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
