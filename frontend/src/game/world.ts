/**
 * GameWorld drives the browser simulation. React feeds an InputState each frame
 * and drains GameEvents for effects, audio, and saving.
 *
 * This file holds world state, the update orchestration, player control, and
 * physics/collision. Combat (enemy AI, attacks, projectiles) lives in the
 * methods further down; shrine leveling and persistence at the end.
 */

import {
  COYOTE_TIME, GRAVITY, JUMP_BUFFER_TIME, LEVEL_ATTACK_REWARD,
  LEVEL_HEALTH_REWARD, LEVEL_STAMINA_REWARD, PLAYER_AIR_ACCEL, PLAYER_AIR_SPEED,
  PLAYER_FALL_GRAVITY, PLAYER_GRAVITY, PLAYER_GROUND_ACCEL, PLAYER_JUMP_SPEED,
  PLAYER_RUN_SPEED, UPGRADE_ATTACK_GAIN, UPGRADE_BASE_COST, UPGRADE_COST_GROWTH,
  UPGRADE_HEALTH_GAIN, UPGRADE_STAMINA_GAIN, approach, clamp, distance,
} from "./constants";
import { BOSS_NAMES, ENEMY_STATS } from "./enemies";
import { LEVELS, type LevelSpec } from "./levels";
import { makeRng } from "./rng";
import type { Enemy, GameEvent, InputState, Player, Projectile, Rect } from "./types";
import { DEFAULT_WEAPONS, WEAPONS, WEAPON_UNLOCKS } from "./weapons";

function rectOf(actor: { x: number; y: number; width: number; height: number }): Rect {
  return { x: actor.x - actor.width / 2, y: actor.y - actor.height / 2, w: actor.width, h: actor.height };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectContains(r: Rect, x: number, y: number): boolean {
  return r.x <= x && x <= r.x + r.w && r.y <= y && y <= r.y + r.h;
}

export class GameWorld {
  rng: () => number;
  levelIndex = 0;
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  events: GameEvent[] = [];
  defeatedBosses = new Set<string>();
  checkpoint: [number, number, number] = [0, 150, 700];
  message: string;
  messageTimer = 4.5;
  gameTime = 0;
  victory = false;
  private projectileCounter = 0;

  constructor(seed = 7) {
    this.rng = makeRng(seed);
    this.player = this.makePlayer();
    this.message = this.level.name;
    this.spawnLevel();
    this.placePlayer(150, this.groundY(150) - this.player.height / 2);
  }

  private makePlayer(): Player {
    return {
      x: 150, y: 700, width: 34, height: 58, vx: 0, vy: 0, facing: 1,
      health: 100, maxHealth: 100, stamina: 100, maxStamina: 100,
      attackPower: 1, characterLevel: 1, weapon: "ash_blade",
      unlockedWeapons: [...DEFAULT_WEAPONS], echoes: 0, flasks: 3, maxFlasks: 3,
      state: "idle", stateTimer: 0, attackConnected: new Set(), invulnTimer: 0,
      parryCooldown: 0, hitFlash: 0, grounded: false, coyoteTimer: 0,
      jumpBuffer: 0, jumpWasDown: false, dead: false,
    };
  }

  get level(): LevelSpec {
    return LEVELS[this.levelIndex];
  }
  get platforms(): Rect[] {
    return this.level.platforms;
  }
  get weaponSpec() {
    return WEAPONS[this.player.weapon] ?? WEAPONS.ash_blade;
  }
  get boss(): Enemy {
    return this.enemies.find((e) => e.id === this.level.bossId)!;
  }
  get bossDefeated(): boolean {
    return this.defeatedBosses.has(this.level.bossId);
  }
  get bossStarted(): boolean {
    const b = this.boss;
    return !b.dead && (b.state !== "idle" || Math.abs(this.player.x - b.x) < 640);
  }

  spawnLevel(): void {
    this.enemies = this.level.spawns.map(([id, kind, x, y]) => this.makeEnemy(id, kind, x, y));
    for (const enemy of this.enemies) {
      const floor = this.groundY(enemy.x);
      if (!enemy.flying && floor < this.level.height + 100) {
        enemy.y = Math.min(enemy.y, floor - enemy.height / 2);
        enemy.homeY = enemy.y;
      }
      if (this.defeatedBosses.has(enemy.id)) {
        enemy.dead = true;
        enemy.health = 0;
        enemy.state = "dead";
      }
    }
    this.projectiles = [];
  }

  private makeEnemy(id: string, kind: string, x: number, y: number): Enemy {
    const s = ENEMY_STATS[kind];
    return {
      id, kind, x, y, homeX: x, homeY: y, width: s.width, height: s.height,
      health: s.health, maxHealth: s.health, damage: s.damage, speed: s.speed,
      reward: s.reward, behavior: s.behavior, boss: s.boss, flying: s.flying,
      vx: 0, vy: 0, facing: -1, state: "idle", stateTimer: 0, cooldown: 0,
      hitFlash: 0, attackConnected: false, dead: false, grounded: false,
    };
  }

  update(dt: number, input: InputState): void {
    dt = Math.min(dt, 0.05);
    this.gameTime += dt;
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    const p = this.player;
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.parryCooldown = Math.max(0, p.parryCooldown - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    for (const e of this.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
    }

    if (p.dead) {
      p.stateTimer -= dt;
      if (p.stateTimer <= 0 && (input.interact || input.attack)) this.respawn();
      return;
    }
    if (this.victory) return;

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.checkHazards();
    this.checkInteraction(input);
  }

  private updatePlayer(dt: number, input: InputState): void {
    const p = this.player;
    const move = clamp(Number(input.right) - Number(input.left), -1, 1);
    if (move) p.facing = move > 0 ? 1 : -1;

    const jumpPressed = input.jump && !p.jumpWasDown;
    p.jumpWasDown = input.jump;
    if (jumpPressed) p.jumpBuffer = JUMP_BUFFER_TIME;
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.coyoteTimer = p.grounded ? COYOTE_TIME : Math.max(0, p.coyoteTimer - dt);

    const locked = ["attack", "heavy", "parry", "hurt"].includes(p.state);
    if (p.state === "dodge") {
      p.stateTimer -= dt;
      p.vx = p.facing * 520;
      if (p.stateTimer <= 0) p.state = "idle";
    } else {
      let target = move * (p.grounded ? PLAYER_RUN_SPEED : PLAYER_AIR_SPEED);
      const accel = p.grounded ? PLAYER_GROUND_ACCEL : PLAYER_AIR_ACCEL;
      if (locked) target *= 0.28;
      p.vx = approach(p.vx, target, accel * dt);
    }

    if (p.jumpBuffer > 0 && p.coyoteTimer > 0 && !["heavy", "hurt", "dodge"].includes(p.state)) {
      p.vy = -PLAYER_JUMP_SPEED;
      p.grounded = false;
      p.coyoteTimer = 0;
      p.jumpBuffer = 0;
      p.state = "jump";
      this.events.push({ kind: "jump", data: { x: p.x, y: p.y } });
    } else if (!input.jump && p.vy < -250) {
      p.vy += 1050 * dt;
    }

    if (["attack", "heavy", "parry", "hurt"].includes(p.state)) {
      p.stateTimer -= dt;
      if (p.state === "attack" || p.state === "heavy") this.applyPlayerAttack();
      if (p.stateTimer <= 0) p.state = "idle";
    }

    const canAct = ["idle", "move", "jump", "fall"].includes(p.state);
    const spec = this.weaponSpec;
    if (canAct && input.parry && p.parryCooldown <= 0 && p.stamina >= 8) {
      p.stamina -= 8;
      p.state = "parry";
      p.stateTimer = 0.32;
      p.parryCooldown = 0.48;
      this.events.push({ kind: "parry_start", data: { x: p.x, y: p.y } });
    } else if (canAct && input.roll && p.stamina >= 25) {
      p.stamina -= 25;
      p.state = "dodge";
      p.stateTimer = 0.24;
      p.invulnTimer = 0.22;
      this.events.push({ kind: "roll", data: { x: p.x, y: p.y } });
    } else if (canAct && input.heavy && p.stamina >= spec.heavyStamina) {
      p.stamina -= spec.heavyStamina;
      p.state = "heavy";
      p.stateTimer = spec.heavyTime;
      p.attackConnected.clear();
      this.events.push({ kind: "swing", data: { heavy: true } });
    } else if (canAct && input.attack && p.stamina >= spec.lightStamina) {
      p.stamina -= spec.lightStamina;
      p.state = "attack";
      p.stateTimer = spec.lightTime;
      p.attackConnected.clear();
      this.events.push({ kind: "swing", data: { heavy: false } });
    } else if (canAct && input.heal && p.flasks > 0 && p.health < p.maxHealth && p.grounded) {
      p.flasks -= 1;
      const healed = Math.min(45, p.maxHealth - p.health);
      p.health += healed;
      this.events.push({ kind: "heal", data: { x: p.x, y: p.y, amount: healed } });
    }

    if (!["attack", "heavy", "parry", "hurt", "dodge"].includes(p.state)) {
      if (!p.grounded) p.state = p.vy < 0 ? "jump" : "fall";
      else if (Math.abs(p.vx) > 18) p.state = "move";
      else p.state = "idle";
    }

    const regen = p.grounded && Math.abs(p.vx) < 20 ? 30 : 20;
    p.stamina = Math.min(p.maxStamina, p.stamina + regen * dt);
    let gravity = p.vy > 0 ? PLAYER_FALL_GRAVITY : PLAYER_GRAVITY;
    if (Math.abs(p.vy) < 105) gravity *= 0.72;
    if (input.down && p.vy > 0) gravity *= 1.18;
    p.vy = Math.min(1020, p.vy + gravity * dt);
    this.moveActor(p, p.vx * dt, p.vy * dt);
  }

  // --- physics --------------------------------------------------------
  private isOneWay(plat: Rect): boolean {
    return plat.h <= 35 && plat.w >= 80;
  }

  private moveActor(actor: Player | Enemy, dx: number, dy: number): void {
    let r = rectOf(actor);
    r.x += dx;
    for (const plat of this.platforms) {
      if (this.isOneWay(plat)) continue;
      if (intersects(r, plat)) {
        if (dx > 0) r.x = plat.x - r.w;
        else if (dx < 0) r.x = plat.x + plat.w;
        actor.vx = 0;
      }
    }
    actor.x = r.x + r.w / 2;

    r = rectOf(actor);
    const oldBottom = r.y + r.h;
    const oldTop = r.y;
    r.y += dy;
    actor.grounded = false;
    for (const plat of this.platforms) {
      if (!intersects(r, plat)) continue;
      if (this.isOneWay(plat)) {
        if (dy >= 0 && oldBottom <= plat.y + 8) {
          r.y = plat.y - r.h;
          actor.vy = 0;
          actor.grounded = true;
        }
        continue;
      }
      if (dy >= 0 && oldBottom <= plat.y + 8) {
        r.y = plat.y - r.h;
        actor.vy = 0;
        actor.grounded = true;
      } else if (dy < 0 && oldTop >= plat.y + plat.h - 8) {
        r.y = plat.y + plat.h;
        actor.vy = 0;
      } else if (r.x + r.w / 2 < plat.x + plat.w / 2) {
        r.x = plat.x - r.w;
        actor.vx = 0;
      } else {
        r.x = plat.x + plat.w;
        actor.vx = 0;
      }
    }
    actor.x = r.x + r.w / 2;
    actor.y = r.y + r.h / 2;
  }

  private groundY(x: number): number {
    let best = this.level.height + 120;
    for (const plat of this.platforms) {
      if (plat.x <= x && x <= plat.x + plat.w && plat.y >= 300) best = Math.min(best, plat.y);
    }
    return best;
  }

  private hasFloorAhead(enemy: Enemy, dir: number): boolean {
    const fx = enemy.x + dir * (enemy.width / 2 + 12);
    const fy = enemy.y + enemy.height / 2 + 12;
    return this.platforms.some(
      (p) => rectContains(p, fx, fy) || (p.x <= fx && fx <= p.x + p.w && p.y <= fy + 18 && p.y >= fy - 8),
    );
  }

  private placePlayer(x: number, y: number): void {
    this.player.x = clamp(x, 60, this.level.width - 60);
    this.player.y = y;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  interactionHint(): string | null {
    const p = this.player;
    if (p.dead && p.stateTimer <= 0) return "ATTACK / INTERACT  Reform at the last ember";
    for (const [sx, sy] of this.level.shrines) {
      if (distance(p.x, p.y, sx, sy) < 95) return "INTERACT  Rest, level up, and rearm";
    }
    const [ex, ey] = this.level.exit;
    if (distance(p.x, p.y, ex, ey) < 125) {
      return this.bossDefeated ? "INTERACT  Cross the pale threshold" : `Defeat ${this.bossName(this.boss)}`;
    }
    return null;
  }

  bossName(enemy: Enemy): string {
    return BOSS_NAMES[enemy.kind] ?? enemy.kind.replace(/_/g, " ").toUpperCase();
  }

  // --- player attack --------------------------------------------------
  private applyPlayerAttack(): void {
    const p = this.player;
    const spec = this.weaponSpec;
    const [reach, height, baseDamage, window] =
      p.state === "attack"
        ? [spec.lightReach, spec.lightHeight, spec.lightDamage, spec.lightActive]
        : [spec.heavyReach, spec.heavyHeight, spec.heavyDamage, spec.heavyActive];
    if (!(window[0] <= p.stateTimer && p.stateTimer <= window[1])) return;
    const damage = baseDamage * p.attackPower;

    for (const enemy of this.enemies) {
      if (enemy.dead || p.attackConnected.has(enemy.id)) continue;
      const forward = (enemy.x - p.x) * p.facing;
      const vertical = Math.abs(enemy.y - p.y);
      if (forward >= -12 && forward <= reach + enemy.width / 2 && vertical <= height) {
        p.attackConnected.add(enemy.id);
        const dealt = damage * (enemy.state === "guard" ? 0.8 : 1);
        enemy.health -= dealt;
        enemy.hitFlash = 0.13;
        if (!enemy.boss || p.state === "heavy") {
          enemy.state = "stagger";
          enemy.stateTimer = enemy.boss ? 0.12 : 0.28;
        }
        enemy.vx += p.facing * (enemy.boss ? 150 : 260);
        this.events.push({ kind: "hit", data: { x: enemy.x, y: enemy.y, damage: dealt, heavy: p.state === "heavy" } });
        if (enemy.health <= 0) this.killEnemy(enemy);
      }
    }
  }

  // --- enemy AI -------------------------------------------------------
  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (enemy.boss && Math.abs(this.player.x - enemy.x) > 680 && enemy.state === "idle") {
        if (!enemy.flying) {
          enemy.vy = Math.min(900, enemy.vy + GRAVITY * dt);
          this.moveActor(enemy, 0, enemy.vy * dt);
        }
        continue;
      }
      this.updateEnemy(enemy, dt);
    }
  }

  private updateEnemy(enemy: Enemy, dt: number): void {
    const p = this.player;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const distX = Math.abs(dx);
    enemy.facing = dx > 0 ? 1 : -1;

    if (["stagger", "windup", "attack", "charge", "recover"].includes(enemy.state)) {
      enemy.stateTimer -= dt;
      if (enemy.state === "attack" || enemy.state === "charge") {
        if (enemy.state === "charge") enemy.vx = enemy.facing * 510;
        this.applyEnemyMelee(enemy, enemy.state === "charge" ? 24 : 0);
      } else {
        enemy.vx = approach(enemy.vx, 0, 700 * dt);
      }
      if (enemy.state === "windup" && enemy.stateTimer <= 0) {
        this.beginEnemyAttack(enemy);
      } else if (enemy.stateTimer <= 0) {
        enemy.state = enemy.state === "attack" || enemy.state === "charge" ? "recover" : "chase";
        if (enemy.state === "recover") {
          enemy.stateTimer = enemy.boss ? 0.3 : 0.45;
          enemy.cooldown = enemy.stateTimer;
        }
      }
      this.enemyPhysics(enemy, dt);
      return;
    }

    const awareness = enemy.boss ? 900 : enemy.behavior === "ranged" ? 650 : 520;
    if (distX < awareness && Math.abs(dy) < 260) {
      enemy.state = "chase";
      const attackRange = enemy.behavior === "ranged" ? 410 : this.enemyAttackRange(enemy);
      if (distX <= attackRange && enemy.cooldown <= 0) {
        enemy.state = "windup";
        enemy.stateTimer = this.enemyWindup(enemy);
        enemy.attackConnected = false;
        this.events.push({ kind: "telegraph", data: { x: enemy.x, y: enemy.y } });
      } else if (enemy.behavior === "ranged" && distX < 240) {
        enemy.vx = -enemy.facing * enemy.speed;
      } else if (!enemy.flying) {
        const desired = enemy.facing * enemy.speed;
        enemy.vx = this.hasFloorAhead(enemy, enemy.facing) ? approach(enemy.vx, desired, 650 * dt) : 0;
      } else {
        enemy.vx = approach(enemy.vx, enemy.facing * enemy.speed, 300 * dt);
        enemy.vy = approach(enemy.vy, clamp(p.y - 90 - enemy.y, -90, 90), 260 * dt);
      }
    } else {
      if (enemy.flying) {
        enemy.vx = Math.sin(this.gameTime * 1.3 + enemy.homeX) * 28;
        enemy.vy = Math.sin(this.gameTime * 1.7 + enemy.homeX) * 18;
      } else {
        let dir = Math.sin(this.gameTime * 0.7 + enemy.homeX) > 0 ? 1 : -1;
        if (Math.abs(enemy.x - enemy.homeX) > 135) dir = enemy.x > enemy.homeX ? -1 : 1;
        enemy.facing = dir;
        enemy.vx = this.hasFloorAhead(enemy, dir) ? dir * enemy.speed * 0.35 : 0;
      }
      enemy.state = "idle";
    }
    this.enemyPhysics(enemy, dt);
  }

  private beginEnemyAttack(enemy: Enemy): void {
    if (enemy.behavior === "ranged") {
      this.shootProjectile(enemy);
      enemy.state = "recover";
      enemy.stateTimer = enemy.boss ? 0.38 : 0.65;
      enemy.cooldown = enemy.boss ? 0.55 : 1.0;
      return;
    }
    if (enemy.behavior === "charger") {
      enemy.state = "charge";
      enemy.stateTimer = 0.46;
      enemy.attackConnected = false;
      return;
    }
    if (enemy.behavior === "leaper") {
      enemy.vy = -430;
      enemy.vx = enemy.facing * 270;
    }
    enemy.state = "attack";
    enemy.stateTimer = enemy.boss ? 0.3 : 0.22;
    enemy.attackConnected = false;
    this.events.push({ kind: "enemy_swing", data: { kind: enemy.kind } });
  }

  private applyEnemyMelee(enemy: Enemy, reachBonus: number): void {
    if (enemy.attackConnected) return;
    const forward = (this.player.x - enemy.x) * enemy.facing;
    const vertical = Math.abs(this.player.y - enemy.y);
    const reach = this.enemyAttackRange(enemy) + reachBonus;
    if (forward >= -8 && forward <= reach + this.player.width / 2 && vertical < enemy.height * 0.72 + 28) {
      enemy.attackConnected = true;
      this.damagePlayer(enemy.damage, enemy, true);
    }
  }

  private shootProjectile(enemy: Enemy): void {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const speed = enemy.boss ? 330 : 285;
    this.projectileCounter += 1;
    this.projectiles.push({
      id: this.projectileCounter, x: enemy.x + enemy.facing * 24, y: enemy.y - 8,
      vx: (dx / len) * speed, vy: (dy / len) * speed, radius: enemy.boss ? 9 : 7,
      damage: enemy.damage * 0.78, owner: "enemy", color: enemy.boss ? "#f0a45c" : "#c88bb9",
      life: 4, reflected: false,
    });
    this.events.push({ kind: "projectile", data: { x: enemy.x, y: enemy.y } });
  }

  private enemyPhysics(enemy: Enemy, dt: number): void {
    if (enemy.flying) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = clamp(enemy.x, 45, this.level.width - 45);
      enemy.y = clamp(enemy.y, 180, 690);
      return;
    }
    enemy.vy = Math.min(950, enemy.vy + GRAVITY * dt);
    this.moveActor(enemy, enemy.vx * dt, enemy.vy * dt);
    if (enemy.y > this.level.height + 100) {
      enemy.x = enemy.homeX;
      enemy.y = enemy.homeY;
      enemy.vx = 0;
      enemy.vy = 0;
    }
  }

  private circleHitsRect(x: number, y: number, radius: number, r: Rect): boolean {
    const nx = clamp(x, r.x, r.x + r.w);
    const ny = clamp(y, r.y, r.y + r.h);
    return Math.hypot(x - nx, y - ny) <= radius;
  }

  private updateProjectiles(dt: number): void {
    for (const proj of this.projectiles) {
      proj.life -= dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      if (proj.owner === "enemy") {
        if (this.circleHitsRect(proj.x, proj.y, proj.radius, rectOf(this.player))) {
          if (this.parryActive()) {
            proj.owner = "player";
            proj.reflected = true;
            proj.vx = this.player.facing * Math.max(420, Math.abs(proj.vx) * 1.45);
            proj.vy *= -0.15;
            proj.damage *= 2;
            proj.color = "#ffd27b";
            this.events.push({ kind: "parry", data: { x: proj.x, y: proj.y } });
          } else if (this.player.invulnTimer <= 0) {
            this.damagePlayer(proj.damage, null, false);
            proj.life = 0;
          }
        }
      } else {
        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          if (this.circleHitsRect(proj.x, proj.y, proj.radius, rectOf(enemy))) {
            enemy.health -= proj.damage;
            enemy.hitFlash = 0.16;
            enemy.state = "stagger";
            enemy.stateTimer = 0.45;
            proj.life = 0;
            this.events.push({ kind: "hit", data: { x: enemy.x, y: enemy.y, damage: proj.damage } });
            if (enemy.health <= 0) this.killEnemy(enemy);
            break;
          }
        }
      }
      if (this.platforms.some((plat) => plat.h < 200 && rectContains(plat, proj.x, proj.y))) {
        proj.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter(
      (p) => p.life > 0 && p.x > -100 && p.x < this.level.width + 100 && p.y > -100 && p.y < this.level.height + 150,
    );
  }

  // --- damage and parry ----------------------------------------------
  private parryActive(): boolean {
    return this.player.state === "parry" && this.player.stateTimer >= 0.09 && this.player.stateTimer <= 0.28;
  }

  private damagePlayer(amount: number, source: Enemy | null, parryable: boolean): void {
    const p = this.player;
    if (p.dead) return;
    if (p.invulnTimer > 0) {
      this.events.push({ kind: "dodge", data: { x: p.x, y: p.y } });
      return;
    }
    if (parryable && this.parryActive() && source) {
      this.parryEnemy(source);
      return;
    }
    p.health -= amount;
    p.hitFlash = 0.2;
    p.invulnTimer = 0.55;
    p.state = "hurt";
    p.stateTimer = 0.22;
    p.vx = (source ? -source.facing : -p.facing) * 270;
    p.vy = -190;
    this.events.push({ kind: "player_hit", data: { damage: amount, x: p.x, y: p.y } });
    if (p.health <= 0) {
      p.health = 0;
      p.dead = true;
      p.state = "dead";
      p.stateTimer = 1.5;
      this.message = "VESSEL BROKEN";
      this.messageTimer = 4;
      this.events.push({ kind: "player_dead" });
    }
  }

  private parryEnemy(enemy: Enemy): void {
    enemy.state = "stagger";
    enemy.stateTimer = enemy.boss ? 0.62 : 1.05;
    enemy.vx = -enemy.facing * (enemy.boss ? 160 : 280);
    enemy.health -= enemy.boss ? 12 : 20;
    this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 22);
    this.events.push({ kind: "parry", data: { x: enemy.x, y: enemy.y } });
    if (enemy.health <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.health = 0;
    enemy.state = "dead";
    this.player.echoes += enemy.reward;
    this.events.push({ kind: "enemy_dead", data: { x: enemy.x, y: enemy.y, kind: enemy.kind } });
    if (enemy.boss) {
      const firstClear = !this.defeatedBosses.has(enemy.id);
      this.defeatedBosses.add(enemy.id);
      if (firstClear) {
        this.grantProgression(this.levelIndex);
        this.unlockWeapon(WEAPON_UNLOCKS[enemy.id]);
      }
      this.message = `${this.bossName(enemy)} SILENCED`;
      this.messageTimer = 5.5;
      this.events.push({ kind: "victory", data: { level: this.levelIndex } });
      this.events.push({ kind: "save_requested" });
    }
  }

  private grantProgression(levelIndex: number): void {
    const target = Math.min(LEVELS.length, levelIndex + 1);
    const p = this.player;
    p.maxHealth += LEVEL_HEALTH_REWARD;
    p.maxStamina += LEVEL_STAMINA_REWARD;
    p.attackPower += LEVEL_ATTACK_REWARD;
    p.health = p.maxHealth;
    p.stamina = p.maxStamina;
    this.events.push({ kind: "progression", data: { rank: target } });
  }

  private unlockWeapon(weaponId: string | undefined): void {
    if (!weaponId || this.player.unlockedWeapons.includes(weaponId)) return;
    this.player.unlockedWeapons.push(weaponId);
    this.events.push({ kind: "weapon_unlocked", data: { weapon: weaponId, name: WEAPONS[weaponId].name } });
  }

  // --- shrine leveling (public API for the UI) ------------------------
  upgradeCost(): number {
    return UPGRADE_BASE_COST + (this.player.characterLevel - 1) * UPGRADE_COST_GROWTH;
  }

  purchaseUpgrade(stat: "vitality" | "endurance" | "strength"): boolean {
    const p = this.player;
    const cost = this.upgradeCost();
    if (p.echoes < cost) return false;
    p.echoes -= cost;
    p.characterLevel += 1;
    if (stat === "vitality") {
      p.maxHealth += UPGRADE_HEALTH_GAIN;
      p.health = p.maxHealth;
    } else if (stat === "endurance") {
      p.maxStamina += UPGRADE_STAMINA_GAIN;
      p.stamina = p.maxStamina;
    } else {
      p.attackPower += UPGRADE_ATTACK_GAIN;
    }
    this.events.push({ kind: "level_up", data: { stat, level: p.characterLevel, x: p.x, y: p.y } });
    this.events.push({ kind: "save_requested" });
    return true;
  }

  equipWeapon(weaponId: string): boolean {
    const p = this.player;
    if (!WEAPONS[weaponId] || !p.unlockedWeapons.includes(weaponId)) return false;
    p.weapon = weaponId;
    return true;
  }

  // --- hazards, interaction, level flow -------------------------------
  private enemyAttackRange(enemy: Enemy): number {
    const ranges: Record<string, number> = {
      shardling: 58, duelist: 72, mauler: 88, lancer: 115,
      root_warden: 122, bell_keeper: 132, pale_regent: 138,
    };
    return ranges[enemy.kind] ?? 75;
  }

  private enemyWindup(enemy: Enemy): number {
    const windups: Record<string, number> = {
      shardling: 0.38, duelist: 0.54, moth: 0.72, mauler: 0.82, lancer: 0.65,
      oracle: 0.78, root_warden: 0.68, bell_keeper: 0.78, pale_regent: 0.52,
    };
    return windups[enemy.kind] ?? 0.5;
  }

  private checkHazards(): void {
    const p = this.player;
    if (p.invulnTimer <= 0 && this.level.hazards.some((h) => intersects(rectOf(p), h))) {
      this.damagePlayer(22, null, false);
      this.returnToCheckpoint();
      return;
    }
    if (p.y > this.level.height + 90) {
      p.health -= 25;
      this.events.push({ kind: "player_hit", data: { damage: 25, x: p.x, y: p.y } });
      if (p.health <= 0) p.health = 1;
      this.returnToCheckpoint();
    }
  }

  private checkInteraction(input: InputState): void {
    if (!input.interact) return;
    const p = this.player;
    for (const [sx, sy] of this.level.shrines) {
      if (distance(p.x, p.y, sx, sy) < 82) {
        this.checkpoint = [this.levelIndex, sx, sy];
        p.health = p.maxHealth;
        p.stamina = p.maxStamina;
        p.flasks = p.maxFlasks;
        this.spawnLevel();
        this.message = "The ember remembers you.";
        this.messageTimer = 2.8;
        this.events.push({ kind: "rest", data: { x: sx, y: sy } });
        this.events.push({ kind: "save_requested" });
        return;
      }
    }
    const [ex, ey] = this.level.exit;
    if (distance(p.x, p.y, ex, ey) < 100) {
      if (!this.bossDefeated) {
        this.message = `${this.bossName(this.boss)} still guards the threshold.`;
        this.messageTimer = 2.5;
        return;
      }
      if (this.levelIndex < LEVELS.length - 1) this.advanceLevel();
      else {
        this.victory = true;
        this.message = "THE LONG DAWN";
        this.messageTimer = 10;
        this.events.push({ kind: "game_complete" });
        this.events.push({ kind: "save_requested" });
      }
    }
  }

  private advanceLevel(): void {
    this.levelIndex += 1;
    this.spawnLevel();
    this.checkpoint = [this.levelIndex, 150, 720];
    this.placePlayer(150, this.groundY(150) - this.player.height / 2);
    this.player.health = this.player.maxHealth;
    this.player.stamina = this.player.maxStamina;
    this.player.flasks = this.player.maxFlasks;
    this.player.state = "idle";
    this.player.invulnTimer = 1;
    this.message = this.level.name;
    this.messageTimer = 5;
    this.events.push({ kind: "level_changed", data: { level: this.levelIndex } });
    this.events.push({ kind: "save_requested" });
  }

  private returnToCheckpoint(): void {
    const [level, x, y] = this.checkpoint;
    if (level !== this.levelIndex) {
      this.levelIndex = level;
      this.spawnLevel();
    }
    const ground = this.groundY(x);
    this.placePlayer(x, Math.min(y, ground - this.player.height / 2));
    this.player.invulnTimer = 1;
  }

  respawn(): void {
    const lost = Math.floor(this.player.echoes * 0.2);
    this.player.echoes -= lost;
    this.returnToCheckpoint();
    this.player.health = this.player.maxHealth;
    this.player.stamina = this.player.maxStamina;
    this.player.flasks = this.player.maxFlasks;
    this.player.dead = false;
    this.player.state = "idle";
    this.player.invulnTimer = 1;
    this.spawnLevel();
    this.message = lost ? `Reformed at the ember. Lost ${lost} echoes.` : "Reformed at the ember.";
    this.messageTimer = 3;
    this.events.push({ kind: "respawn" });
  }

  // --- persistence ----------------------------------------------------
  toSave() {
    const p = this.player;
    return {
      version: 1,
      levelIndex: this.levelIndex,
      checkpoint: this.checkpoint,
      defeatedBosses: [...this.defeatedBosses],
      gameTime: this.gameTime,
      victory: this.victory,
      player: {
        health: p.health, maxHealth: p.maxHealth, stamina: p.stamina,
        maxStamina: p.maxStamina, attackPower: p.attackPower,
        characterLevel: p.characterLevel, echoes: p.echoes, weapon: p.weapon,
        unlockedWeapons: [...p.unlockedWeapons],
      },
    };
  }

  loadSave(data: ReturnType<GameWorld["toSave"]>): void {
    this.levelIndex = clamp(data.levelIndex ?? 0, 0, LEVELS.length - 1);
    this.defeatedBosses = new Set(data.defeatedBosses ?? []);
    this.spawnLevel();
    const sp = data.player ?? ({} as typeof data.player);
    const p = this.player;
    p.maxHealth = sp.maxHealth ?? p.maxHealth;
    p.maxStamina = sp.maxStamina ?? p.maxStamina;
    p.attackPower = sp.attackPower ?? p.attackPower;
    p.characterLevel = sp.characterLevel ?? 1;
    p.echoes = sp.echoes ?? 0;
    p.unlockedWeapons = sp.unlockedWeapons?.length ? [...sp.unlockedWeapons] : [...DEFAULT_WEAPONS];
    if (sp.weapon && p.unlockedWeapons.includes(sp.weapon)) p.weapon = sp.weapon;
    p.health = clamp(sp.health ?? p.maxHealth, 1, p.maxHealth);
    p.stamina = clamp(sp.stamina ?? p.maxStamina, 0, p.maxStamina);
    const cp = data.checkpoint ?? [this.levelIndex, 150, 720];
    this.checkpoint = [clamp(cp[0], 0, LEVELS.length - 1), cp[1], cp[2]];
    if (this.checkpoint[0] !== this.levelIndex) this.checkpoint = [this.levelIndex, 150, 720];
    this.placePlayer(this.checkpoint[1], this.checkpoint[2]);
    this.gameTime = data.gameTime ?? 0;
    this.victory = Boolean(data.victory);
    this.message = "The ember recalls your shape.";
    this.messageTimer = 2.5;
  }
}
