import { TopBar } from "./TopBar";

const CONTROLS: [string, string][] = [
  ["A / D / Left / Right", "Move left and right"],
  ["W / Space / Up", "Jump (release early for a shorter hop)"],
  ["J / Left click", "Light attack"],
  ["K / Middle click", "Heavy attack"],
  ["L / Right click", "Parry - time it against the bright impact flash"],
  ["Shift", "Dodge roll (brief invulnerability)"],
  ["Q", "Use a healing flask"],
  ["E", "Rest at a shrine, level up, or cross a cleared threshold"],
  ["Esc", "Pause"],
];

export function HowToPlay() {
  return (
    <div className="page" style={{ padding: "0 1rem 3rem" }}>
      <TopBar title="COMBAT MANUAL" />
      <section style={{ padding: "1.5rem 0" }}>
        <p>
          SoulsFan Games is a deliberate, souls-like platformer. Stamina gates your
          offense and defense, so trade blows with intent. A well-timed{" "}
          <strong>parry</strong> staggers melee foes and reflects projectiles
          back at their casters.
        </p>
        <table>
          <thead>
            <tr>
              <th>Input</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map(([key, desc]) => (
              <tr key={key}>
                <td style={{ color: "var(--ember)" }}>{key}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Progression</h2>
        <p>
          Rest at checkpoints to spend echoes on levels - Vitality, Endurance,
          or Strength - and to swap weapons. Defeating each level guardian
          permanently raises your stats and unlocks a new weapon.
        </p>
      </section>
    </div>
  );
}
