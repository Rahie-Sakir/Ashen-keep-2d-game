/**
 * Canvas renderer for SoulsFan Games. The renderer is deliberately asset-free:
 * silhouettes, weapons, level backdrops, hazards, and UI are all drawn with
 * Canvas primitives so the game remains a pure React + TypeScript web app.
 */

import { BOSS_NAMES } from "./enemies";
import { clamp } from "./constants";
import type { Enemy, Player } from "./types";
import { WEAPONS } from "./weapons";
import type { GameWorld } from "./world";

export interface Camera {
  x: number;
  y: number;
}

type LevelMood = "moonroot" | "foundry" | "basilica";

interface EnemyWeaponSpec {
  length: number;
  width: number;
  color: string;
  glow: string;
  kind: "claw" | "sword" | "staff" | "hammer" | "spear" | "glaive";
}

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private width: number,
    private height: number,
  ) {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  draw(world: GameWorld, cam: Camera, shake = 0): void {
    const ctx = this.ctx;
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;

    ctx.save();
    this.drawSky(world, cam);
    this.drawParallax(world, cam);

    ctx.translate(-cam.x + ox, -cam.y + oy);
    this.drawWorldDecorations(world);
    this.drawHazards(world);
    this.drawPlatforms(world);
    this.drawShrines(world);
    this.drawExit(world);
    this.drawProjectiles(world);
    for (const enemy of world.enemies) {
      if (!enemy.dead) this.drawEnemy(world, enemy);
    }
    this.drawPlayer(world);
    this.drawForegroundMist(world, cam);
    ctx.restore();

    this.drawHud(world);
    this.drawVignette();
  }

  // --- scene ---------------------------------------------------------
  private drawSky(world: GameWorld, cam: Camera): void {
    const ctx = this.ctx;
    const p = world.level.palette;
    const mood = world.level.id as LevelMood;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, p.sky);
    grad.addColorStop(0.55, p.skyLow);
    grad.addColorStop(1, mood === "foundry" ? "#251114" : "#080910");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    const t = world.gameTime;
    if (mood === "moonroot") {
      const moonX = this.width * 0.78 - cam.x * 0.025;
      const moonY = this.height * 0.18 - cam.y * 0.02;
      this.screenGlow(moonX, moonY, 120, "#d9d8c8", 0.22);
      ctx.fillStyle = "#d9d8c8";
      ctx.beginPath();
      ctx.arc(moonX, moonY, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.sky;
      ctx.beginPath();
      ctx.arc(moonX + 25, moonY - 12, 56, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === "foundry") {
      const coreX = this.width * 0.74 - cam.x * 0.018;
      const coreY = this.height * 0.34;
      this.screenGlow(coreX, coreY, 210, "#e06d38", 0.28);
      this.screenGlow(coreX, coreY, 90 + Math.sin(t * 2) * 8, "#ffc36c", 0.25);
    } else {
      const glassX = this.width * 0.72 - cam.x * 0.018;
      const glassY = this.height * 0.25;
      this.screenGlow(glassX, glassY, 170, "#c9b7de", 0.18);
      ctx.strokeStyle = "rgba(220,205,235,0.34)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(glassX, glassY, 62, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(glassX, glassY);
        ctx.lineTo(glassX + Math.cos(a) * 62, glassY + Math.sin(a) * 62);
        ctx.stroke();
      }
    }

    for (let i = 0; i < 70; i += 1) {
      const x = (i * 173 - cam.x * 0.04) % (this.width + 80) - 40;
      const y = 30 + ((i * 91) % Math.max(160, this.height * 0.58));
      const alpha = 0.18 + ((i % 5) * 0.035);
      ctx.fillStyle = `rgba(238,230,213,${alpha})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
  }

  private drawParallax(world: GameWorld, cam: Camera): void {
    const ctx = this.ctx;
    const mood = world.level.id as LevelMood;
    const horizon = this.height * 0.72;
    const layers = [
      { speed: 0.08, color: "rgba(5,6,10,0.35)", height: 115, count: 14 },
      { speed: 0.16, color: "rgba(5,6,10,0.55)", height: 150, count: 11 },
    ];

    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      for (let i = 0; i < layer.count; i += 1) {
        const x = (i * 360 - cam.x * layer.speed) % (this.width + 420) - 180;
        const w = 130 + ((i * 37) % 120);
        const h = layer.height + ((i * 29) % 80);
        if (mood === "moonroot") {
          ctx.beginPath();
          ctx.moveTo(x, this.height);
          ctx.quadraticCurveTo(x + w * 0.5, horizon - h, x + w, this.height);
          ctx.fill();
          ctx.fillRect(x + w * 0.45, horizon - h * 0.6, 12, h * 0.7);
        } else if (mood === "foundry") {
          ctx.fillRect(x, horizon - h, w * 0.72, h + 180);
          ctx.fillRect(x + w * 0.2, horizon - h - 45, w * 0.25, 50);
        } else {
          ctx.fillRect(x, horizon - h, w * 0.18, h + 180);
          ctx.fillRect(x + w * 0.45, horizon - h * 0.85, w * 0.14, h + 150);
          ctx.beginPath();
          ctx.arc(x + w * 0.5, horizon - h * 0.86, 48, Math.PI, 0);
          ctx.fill();
        }
      }
    }
  }

  private drawWorldDecorations(world: GameWorld): void {
    const ctx = this.ctx;
    const mood = world.level.id as LevelMood;
    for (let i = 0; i < 11; i += 1) {
      const x = 170 + i * 340 + ((i * 53) % 80);
      const ground = 780;
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      if (mood === "moonroot") {
        ctx.fillRect(x - 8, ground - 190, 16, 190);
        ctx.beginPath();
        ctx.arc(x - 35, ground - 170, 54, 0, Math.PI * 2);
        ctx.arc(x + 38, ground - 150, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(125,154,154,0.22)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - 70, ground - 42);
        ctx.quadraticCurveTo(x, ground - 120, x + 92, ground - 34);
        ctx.stroke();
      } else if (mood === "foundry") {
        ctx.fillRect(x - 38, ground - 220, 76, 220);
        ctx.fillStyle = "rgba(255,160,80,0.12)";
        ctx.fillRect(x - 22, ground - 100, 44, 70);
        ctx.strokeStyle = "rgba(255,202,107,0.18)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(x + 80, ground - 250, 38, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillRect(x - 18, ground - 260, 36, 260);
        ctx.fillRect(x - 55, ground - 120, 110, 24);
        ctx.strokeStyle = "rgba(201,183,222,0.16)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, ground - 235, 50, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawPlatforms(world: GameWorld): void {
    const ctx = this.ctx;
    const p = world.level.palette;
    const cap =
      world.level.id === "moonroot"
        ? "#415e49"
        : world.level.id === "foundry"
          ? "#68402f"
          : "#514766";
    for (const plat of world.platforms) {
      if (plat.w < 36 && plat.h > 200) continue;
      const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
      grad.addColorStop(0, cap);
      grad.addColorStop(0.18, p.stone);
      grad.addColorStop(1, "#0b0c12");
      ctx.fillStyle = grad;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.fillRect(plat.x, plat.y + plat.h - 14, plat.w, 14);
      ctx.fillStyle = cap;
      ctx.fillRect(plat.x, plat.y - 5, plat.w, 12);
      ctx.fillStyle = p.edge;
      ctx.fillRect(plat.x, plat.y - 5, plat.w, 2);

      ctx.strokeStyle = "rgba(238,230,213,0.08)";
      ctx.lineWidth = 1;
      for (let x = plat.x + 18; x < plat.x + plat.w - 8; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, plat.y + 16);
        ctx.lineTo(x + 18, plat.y + Math.min(plat.h - 8, 46));
        ctx.stroke();
      }
    }
  }

  private drawHazards(world: GameWorld): void {
    const ctx = this.ctx;
    const [surface, deep, glow] =
      world.level.id === "moonroot"
        ? ["#3e7079", "#101e26", "#71c6c7"]
        : world.level.id === "foundry"
          ? ["#f07b35", "#3a130d", "#ffb15d"]
          : ["#5b4b88", "#120c1d", "#c9b7de"];
    for (const h of world.level.hazards) {
      ctx.fillStyle = deep;
      ctx.fillRect(h.x, h.y + 20, h.w, h.h);
      this.glow(h.x + h.w / 2, h.y + 34, h.w * 0.55, glow, 0.18);
      ctx.fillStyle = surface;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y + h.h);
      for (let i = 0; i <= 14; i += 1) {
        const x = h.x + (i * h.w) / 14;
        const wave = Math.sin(world.gameTime * 3.2 + i + h.x * 0.04) * 4.5;
        ctx.lineTo(x, h.y + 26 + wave);
      }
      ctx.lineTo(h.x + h.w, h.y + h.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.hexAlpha(glow, 0.55);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawShrines(world: GameWorld): void {
    const ctx = this.ctx;
    for (const [x, y] of world.level.shrines) {
      const pulse = 8 + Math.sin(world.gameTime * 4) * 2;
      this.glow(x, y - 26, 58, "#f2a65a", 0.32);
      ctx.strokeStyle = "#8f7967";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - 30, y + 16);
      ctx.lineTo(x + 26, y - 8);
      ctx.stroke();
      ctx.fillStyle = "#ffd37b";
      ctx.beginPath();
      ctx.arc(x, y - 30, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,211,123,0.22)";
      ctx.beginPath();
      ctx.arc(x, y - 30, pulse * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawExit(world: GameWorld): void {
    const ctx = this.ctx;
    const [x, y] = world.level.exit;
    const unlocked = world.bossDefeated;
    const color = unlocked ? "#ffd37b" : world.level.palette.enemy;
    this.glow(x, y - 55, unlocked ? 105 : 70, color, unlocked ? 0.33 : 0.2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y - 58, 58, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 58, y - 58);
    ctx.lineTo(x - 58, y + 35);
    ctx.moveTo(x + 58, y - 58);
    ctx.lineTo(x + 58, y + 35);
    ctx.stroke();
    if (!unlocked) {
      ctx.strokeStyle = "rgba(238,230,213,0.16)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 42, y - 12);
      ctx.lineTo(x + 42, y - 12);
      ctx.stroke();
    }
  }

  private drawProjectiles(world: GameWorld): void {
    const ctx = this.ctx;
    for (const proj of world.projectiles) {
      this.glow(proj.x, proj.y, proj.radius * 4.2, proj.color, 0.42);
      ctx.strokeStyle = this.hexAlpha(proj.color, 0.65);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(proj.x - proj.vx * 0.045, proj.y - proj.vy * 0.045);
      ctx.lineTo(proj.x, proj.y);
      ctx.stroke();
      ctx.fillStyle = proj.reflected ? "#fff0c0" : proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawForegroundMist(world: GameWorld, cam: Camera): void {
    const ctx = this.ctx;
    const color =
      world.level.id === "foundry"
        ? "rgba(255,160,80,0.08)"
        : world.level.id === "basilica"
          ? "rgba(201,183,222,0.08)"
          : "rgba(125,154,154,0.08)";
    ctx.fillStyle = color;
    for (let i = 0; i < 18; i += 1) {
      const x = cam.x + ((i * 251 + world.gameTime * 24) % (this.width + 180)) - 90;
      const y = cam.y + 130 + ((i * 79) % Math.max(180, this.height - 190));
      ctx.beginPath();
      ctx.ellipse(x, y, 80 + (i % 4) * 18, 8 + (i % 3) * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- actors --------------------------------------------------------
  private drawEnemy(world: GameWorld, enemy: Enemy): void {
    const ctx = this.ctx;
    const palette = world.level.palette;
    const flash = enemy.hitFlash > 0;
    const body = flash ? "#eee6d5" : enemy.boss ? palette.enemy : this.enemyColor(enemy.kind);
    const trim = enemy.boss ? palette.accent : "#b9a992";
    const w = enemy.width;
    const h = enemy.height;

    this.shadow(enemy.x, enemy.y + h / 2 - 2, w * 0.72, enemy.flying ? 5 : 9);
    if (enemy.state === "windup") {
      this.glow(enemy.x + enemy.facing * (w * 0.9), enemy.y - h * 0.12, 46, "#ffd37b", 0.32);
    }

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.scale(enemy.facing, 1);

    if (enemy.flying) {
      this.drawEnemyWings(enemy, body);
    }

    ctx.fillStyle = body;
    if (enemy.boss) {
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.58);
      ctx.bezierCurveTo(w * 0.55, -h * 0.42, w * 0.46, h * 0.2, w * 0.34, h * 0.52);
      ctx.lineTo(-w * 0.34, h * 0.52);
      ctx.bezierCurveTo(-w * 0.52, h * 0.08, -w * 0.5, -h * 0.38, 0, -h * 0.58);
      ctx.fill();
      ctx.fillStyle = this.hexAlpha(trim, 0.3);
      ctx.fillRect(-w * 0.32, -h * 0.1, w * 0.64, 5);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.52);
      ctx.lineTo(w * 0.42, h * 0.48);
      ctx.lineTo(-w * 0.42, h * 0.48);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, h * 0.12);
    ctx.lineTo(-w * 0.5, h * 0.48);
    ctx.moveTo(w * 0.22, h * 0.12);
    ctx.lineTo(w * 0.44, h * 0.48);
    ctx.stroke();

    this.drawEnemyWeapon(enemy);
    this.drawEnemyMask(enemy, flash, trim);
    ctx.restore();

    if (!enemy.boss && enemy.health < enemy.maxHealth) {
      this.bar(enemy.x - 25, enemy.y - h / 2 - 20, 50, 6, enemy.health / enemy.maxHealth, "#b94b55");
    }
  }

  private drawEnemyWings(enemy: Enemy, color: string): void {
    const ctx = this.ctx;
    const wing = this.hexAlpha(color, 0.52);
    const flap = Math.sin(Date.now() * 0.008 + enemy.x * 0.03) * 0.18;
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(-18, -12, 24, 11, -0.7 + flap, 0, Math.PI * 2);
    ctx.ellipse(18, -12, 24, 11, 0.7 - flap, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEnemyMask(enemy: Enemy, flash: boolean, trim: string): void {
    const ctx = this.ctx;
    const w = enemy.width;
    const h = enemy.height;
    ctx.fillStyle = flash ? "#ffffff" : "#d9cdb9";
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.48, w * 0.2, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1a20";
    ctx.fillRect(3, -h * 0.49, 5, 3);
    if (enemy.boss) {
      ctx.strokeStyle = trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w * 0.24, -h * 0.58);
      ctx.lineTo(-w * 0.08, -h * 0.68);
      ctx.moveTo(w * 0.24, -h * 0.58);
      ctx.lineTo(w * 0.08, -h * 0.68);
      ctx.stroke();
    }
  }

  private drawEnemyWeapon(enemy: Enemy): void {
    const ctx = this.ctx;
    const spec = this.enemyWeapon(enemy);
    const attackRatio = this.enemyAttackRatio(enemy);
    const windup = enemy.state === "windup";
    const active = enemy.state === "attack" || enemy.state === "charge";
    const shoulderX = enemy.width * 0.18;
    const shoulderY = -enemy.height * 0.1;
    let angle = -0.5;
    if (windup) angle = -1.2;
    if (active) angle = -1.15 + attackRatio * 1.95;
    if (enemy.state === "charge") angle = -0.03;
    if (enemy.kind === "lancer" || enemy.kind === "pale_regent") angle *= 0.45;

    const sx = shoulderX;
    const sy = shoulderY;
    const ex = sx + Math.cos(angle) * spec.length;
    const ey = sy + Math.sin(angle) * spec.length;
    if (windup || active) {
      this.localGlow(ex, ey, active ? 26 : 18, spec.glow, active ? 0.4 : 0.25);
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#151018";
    ctx.lineWidth = spec.width + 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = spec.color;
    ctx.lineWidth = spec.width;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    if (spec.kind === "spear" || spec.kind === "glaive") {
      ctx.fillStyle = spec.glow;
      ctx.beginPath();
      ctx.moveTo(ex + 12, ey);
      ctx.lineTo(ex - 8, ey - 8);
      ctx.lineTo(ex - 4, ey + 9);
      ctx.closePath();
      ctx.fill();
    } else if (spec.kind === "hammer") {
      ctx.fillStyle = spec.color;
      ctx.fillRect(ex - 12, ey - 10, 24, 20);
      ctx.strokeStyle = "#151018";
      ctx.strokeRect(ex - 12, ey - 10, 24, 20);
    } else if (spec.kind === "staff") {
      ctx.fillStyle = spec.glow;
      ctx.beginPath();
      ctx.arc(ex, ey, windup ? 10 : 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.kind === "claw") {
      ctx.strokeStyle = spec.glow;
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(ex - 6, ey + i * 6);
        ctx.lineTo(ex + 12, ey + i * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawPlayer(world: GameWorld): void {
    const ctx = this.ctx;
    const pl = world.player;
    const flash = pl.hitFlash > 0;
    this.shadow(pl.x, pl.y + pl.height / 2 - 4, 24, 8);

    ctx.save();
    ctx.translate(pl.x, pl.y);
    ctx.scale(pl.facing, 1);

    ctx.fillStyle = flash ? "#eee6d5" : "#252837";
    ctx.beginPath();
    ctx.moveTo(-13, -18);
    ctx.lineTo(17, -15);
    ctx.lineTo(22, 28);
    ctx.lineTo(-22, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(242,166,90,0.22)";
    ctx.fillRect(-15, 4, 31, 5);

    ctx.fillStyle = "#eee6d5";
    ctx.beginPath();
    ctx.ellipse(0, -31, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1a20";
    ctx.fillRect(4, -32, 5, 3);

    this.drawPlayerWeapon(pl);
    if (pl.state === "parry") {
      const active = pl.stateTimer >= 0.09 && pl.stateTimer <= 0.28;
      ctx.strokeStyle = active ? "#ffd37b" : "#75625c";
      ctx.lineWidth = active ? 5 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, 45, -0.9, 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayerWeapon(pl: Player): void {
    const ctx = this.ctx;
    const spec = WEAPONS[pl.weapon] ?? WEAPONS.ash_blade;
    let angle = 0.78;
    if (pl.state === "attack") angle = -1.2 + (1 - pl.stateTimer / spec.lightTime) * 2.3;
    else if (pl.state === "heavy") angle = -1.6 + (1 - pl.stateTimer / spec.heavyTime) * 3.0;
    else if (pl.state === "parry") angle = -0.35;
    const len = pl.state === "heavy" ? spec.heavyReach * 0.7 : spec.lightReach * 0.78;
    const sx = 5;
    const sy = -2;
    const ex = sx + Math.cos(angle) * len;
    const ey = sy + Math.sin(angle) * len;
    const active = pl.state === "attack" || pl.state === "heavy";

    if (active) this.localGlow(ex, ey, 34, "#ffd37b", 0.28);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#131016";
    ctx.lineWidth = spec.style === "hammer" ? 10 : 7;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = "#f2eadb";
    ctx.lineWidth = spec.style === "hammer" ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (spec.style === "hammer") {
      ctx.fillStyle = "#f2eadb";
      ctx.fillRect(ex - 12, ey - 10, 24, 20);
    } else if (spec.style === "spear") {
      ctx.fillStyle = "#ffd37b";
      ctx.beginPath();
      ctx.moveTo(ex + 12, ey);
      ctx.lineTo(ex - 8, ey - 7);
      ctx.lineTo(ex - 4, ey + 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- HUD -----------------------------------------------------------
  private drawHud(world: GameWorld): void {
    const ctx = this.ctx;
    const pl: Player = world.player;
    ctx.fillStyle = "rgba(8,9,14,0.88)";
    ctx.fillRect(16, 16, 334, 104);
    ctx.strokeStyle = "#6e6570";
    ctx.strokeRect(16, 16, 334, 104);
    ctx.fillStyle = "#eee6d5";
    ctx.font = "bold 13px Georgia";
    ctx.fillText("SOULSFAN RUNNER", 30, 37);
    ctx.fillStyle = "#f2a65a";
    ctx.textAlign = "right";
    ctx.fillText(WEAPONS[pl.weapon]?.name ?? "", 336, 37);
    ctx.textAlign = "left";
    this.bar(30, 48, 300, 14, pl.health / pl.maxHealth, "#b94b55");
    this.bar(30, 68, 260, 8, pl.stamina / pl.maxStamina, "#77a68c");
    ctx.fillStyle = "#f2a65a";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`FLASK ${pl.flasks}/${pl.maxFlasks}`, 30, 96);
    ctx.fillStyle = "#bcb4a7";
    ctx.fillText(`ECHOES ${pl.echoes}`, 130, 96);
    ctx.fillStyle = "#e7b660";
    ctx.fillText(`LV ${pl.characterLevel}  DAMAGE ${pl.attackPower.toFixed(2)}x`, 30, 111);

    const boss = world.boss;
    if (world.bossStarted && !boss.dead) {
      const bw = Math.min(720, this.width - 190);
      const x = (this.width - bw) / 2;
      ctx.fillStyle = "#eee6d5";
      ctx.font = "bold 13px Georgia";
      ctx.textAlign = "center";
      ctx.fillText(BOSS_NAMES[boss.kind] ?? boss.kind.toUpperCase(), this.width / 2, this.height - 64);
      ctx.textAlign = "left";
      this.bar(x, this.height - 52, bw, 12, boss.health / boss.maxHealth, world.level.palette.enemy);
    }

    const hint = world.interactionHint();
    if (hint) {
      ctx.fillStyle = "rgba(8,9,14,0.92)";
      ctx.fillRect(this.width / 2 - 205, this.height - 104, 410, 32);
      ctx.strokeStyle = "rgba(242,166,90,0.45)";
      ctx.strokeRect(this.width / 2 - 205, this.height - 104, 410, 32);
      ctx.fillStyle = "#eee6d5";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(hint, this.width / 2, this.height - 84);
      ctx.textAlign = "left";
    }
    if (world.messageTimer > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "bold 30px Georgia";
      ctx.textAlign = "center";
      ctx.fillText(world.message, this.width / 2 + 2, this.height * 0.22 + 2);
      ctx.fillStyle = world.message === "VESSEL BROKEN" ? "#ad414d" : "#eee6d5";
      ctx.fillText(world.message, this.width / 2, this.height * 0.22);
      ctx.textAlign = "left";
    }
  }

  // --- helpers -------------------------------------------------------
  private enemyWeapon(enemy: Enemy): EnemyWeaponSpec {
    const common = { color: "#d8c9ad", glow: "#ffd37b" };
    const specs: Record<string, EnemyWeaponSpec> = {
      shardling: { ...common, kind: "claw", length: 34, width: 4 },
      duelist: { ...common, kind: "sword", length: 66, width: 4 },
      moth: { color: "#cbb3e0", glow: "#e9c9ff", kind: "staff", length: 48, width: 4 },
      mauler: { ...common, kind: "hammer", length: 74, width: 7 },
      lancer: { ...common, kind: "spear", length: 106, width: 4 },
      oracle: { color: "#d7b9ef", glow: "#f0c4ff", kind: "staff", length: 62, width: 5 },
      root_warden: { color: "#caa46d", glow: "#ffd37b", kind: "claw", length: 82, width: 7 },
      bell_keeper: { color: "#ffd37b", glow: "#ffbf5d", kind: "hammer", length: 94, width: 9 },
      pale_regent: { color: "#f2eadb", glow: "#f0c4ff", kind: "glaive", length: 112, width: 6 },
    };
    return specs[enemy.kind] ?? { ...common, kind: "sword", length: 62, width: 4 };
  }

  private enemyAttackRatio(enemy: Enemy): number {
    const durations: Record<string, number> = {
      attack: enemy.boss ? 0.3 : 0.22,
      charge: 0.46,
      windup: 0.7,
    };
    const duration = durations[enemy.state] ?? 0.4;
    return clamp(1 - enemy.stateTimer / duration, 0, 1);
  }

  private bar(x: number, y: number, w: number, h: number, ratio: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#17171d";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(ratio, 0, 1), h - 4);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(ratio, 0, 1), Math.max(1, h * 0.25));
  }

  private shadow(x: number, y: number, rx: number, ry: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private glow(x: number, y: number, radius: number, color: string, alpha = 0.5): void {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, this.hexAlpha(color, alpha));
    g.addColorStop(1, this.hexAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private localGlow(x: number, y: number, radius: number, color: string, alpha = 0.4): void {
    this.glow(x, y, radius, color, alpha);
  }

  private screenGlow(x: number, y: number, radius: number, color: string, alpha: number): void {
    this.glow(x, y, radius, color, alpha);
  }

  private drawVignette(): void {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      Math.min(this.width, this.height) * 0.25,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.7,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private hexAlpha(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  private enemyColor(kind: string): string {
    const colors: Record<string, string> = {
      shardling: "#513044",
      duelist: "#343045",
      moth: "#675079",
      mauler: "#563633",
      lancer: "#303848",
      oracle: "#4f3b62",
    };
    return colors[kind] ?? "#343045";
  }
}
