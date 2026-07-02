/** Shared game data structures for the web simulation. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WeaponStyle = "blade" | "daggers" | "hammer" | "spear";

export interface WeaponSpec {
  id: string;
  name: string;
  style: WeaponStyle;
  lightReach: number;
  lightHeight: number;
  lightDamage: number;
  lightTime: number;
  lightActive: [number, number];
  lightStamina: number;
  heavyReach: number;
  heavyHeight: number;
  heavyDamage: number;
  heavyTime: number;
  heavyActive: [number, number];
  heavyStamina: number;
}

export type PlayerState =
  | "idle"
  | "move"
  | "jump"
  | "fall"
  | "attack"
  | "heavy"
  | "parry"
  | "dodge"
  | "hurt"
  | "dead";

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  facing: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  attackPower: number;
  characterLevel: number;
  weapon: string;
  unlockedWeapons: string[];
  echoes: number;
  flasks: number;
  maxFlasks: number;
  state: PlayerState;
  stateTimer: number;
  attackConnected: Set<string>;
  invulnTimer: number;
  parryCooldown: number;
  hitFlash: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBuffer: number;
  jumpWasDown: boolean;
  dead: boolean;
}

export type EnemyBehavior =
  | "leaper"
  | "melee"
  | "ranged"
  | "heavy"
  | "charger"
  | "boss";

export interface Enemy {
  id: string;
  kind: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  reward: number;
  behavior: EnemyBehavior;
  boss: boolean;
  flying: boolean;
  vx: number;
  vy: number;
  facing: number;
  state: string;
  stateTimer: number;
  cooldown: number;
  hitFlash: number;
  attackConnected: boolean;
  dead: boolean;
  grounded: boolean;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  owner: "enemy" | "player";
  color: string;
  life: number;
  reflected: boolean;
}

export interface GameEvent {
  kind: string;
  data?: Record<string, unknown>;
}

export interface InputState {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
  heavy: boolean;
  parry: boolean;
  roll: boolean;
  heal: boolean;
  interact: boolean;
}

export function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    down: false,
    jump: false,
    attack: false,
    heavy: false,
    parry: false,
    roll: false,
    heal: false,
    interact: false,
  };
}
