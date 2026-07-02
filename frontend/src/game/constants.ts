/**
 * Physics and progression constants for the browser simulation.
 */

export const WORLD_HEIGHT = 900;

export const GRAVITY = 1850;
export const PLAYER_GRAVITY = 1720;
export const PLAYER_FALL_GRAVITY = 1850;
export const PLAYER_JUMP_SPEED = 850;
export const PLAYER_RUN_SPEED = 260;
export const PLAYER_AIR_SPEED = 250;
export const PLAYER_GROUND_ACCEL = 2100;
export const PLAYER_AIR_ACCEL = 1350;
export const JUMP_BUFFER_TIME = 0.16;
export const COYOTE_TIME = 0.14;

export const LEVEL_HEALTH_REWARD = 15;
export const LEVEL_STAMINA_REWARD = 15;
export const LEVEL_ATTACK_REWARD = 0.12;

export const UPGRADE_BASE_COST = 90;
export const UPGRADE_COST_GROWTH = 55;
export const UPGRADE_HEALTH_GAIN = 10;
export const UPGRADE_STAMINA_GAIN = 8;
export const UPGRADE_ATTACK_GAIN = 0.06;

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

export function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(target, value + amount);
  return Math.max(target, value - amount);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}
