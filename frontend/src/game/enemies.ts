/** Enemy archetype stats for the three-level browser game. */

import type { EnemyBehavior } from "./types";

export interface EnemyStat {
  width: number;
  height: number;
  health: number;
  damage: number;
  speed: number;
  reward: number;
  behavior: EnemyBehavior;
  boss: boolean;
  flying: boolean;
}

export const ENEMY_STATS: Record<string, EnemyStat> = {
  shardling: { width: 42, height: 36, health: 48, damage: 13, speed: 125, reward: 25, behavior: "leaper", boss: false, flying: false },
  duelist: { width: 38, height: 62, health: 90, damage: 19, speed: 105, reward: 55, behavior: "melee", boss: false, flying: false },
  moth: { width: 48, height: 38, health: 60, damage: 15, speed: 80, reward: 45, behavior: "ranged", boss: false, flying: true },
  mauler: { width: 56, height: 70, health: 145, damage: 27, speed: 72, reward: 85, behavior: "heavy", boss: false, flying: false },
  lancer: { width: 40, height: 64, health: 105, damage: 22, speed: 105, reward: 70, behavior: "charger", boss: false, flying: false },
  oracle: { width: 42, height: 60, health: 82, damage: 17, speed: 70, reward: 65, behavior: "ranged", boss: false, flying: false },
  root_warden: { width: 86, height: 112, health: 620, damage: 25, speed: 86, reward: 500, behavior: "boss", boss: true, flying: false },
  bell_keeper: { width: 96, height: 126, health: 760, damage: 29, speed: 82, reward: 700, behavior: "boss", boss: true, flying: false },
  pale_regent: { width: 82, height: 118, health: 900, damage: 31, speed: 108, reward: 1000, behavior: "boss", boss: true, flying: false },
};

export const BOSS_NAMES: Record<string, string> = {
  root_warden: "THE ROOT WARDEN",
  bell_keeper: "THE BELL KEEPER",
  pale_regent: "THE PALE REGENT",
};
