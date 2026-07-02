/**
 * Hosts the <canvas>, drives the fixed-ish game loop with requestAnimationFrame,
 * follows the player with a smoothed camera, applies screen shake from events,
 * and forwards drained game events to the parent each frame.
 */

import { useEffect, useRef } from "react";

import type { GameEvent, InputState } from "./types";
import { clamp } from "./constants";
import { Renderer, type Camera } from "./render";
import type { GameWorld } from "./world";

interface Props {
  world: GameWorld;
  sampleInput: () => InputState;
  isPaused: () => boolean;
  onEvents: (events: GameEvent[]) => void;
  width?: number;
  height?: number;
}

export function GameCanvas({
  world,
  sampleInput,
  isPaused,
  onEvents,
  width = 1100,
  height = 620,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const renderer = new Renderer(ctx, width, height);
    const cam: Camera = {
      x: clamp(world.player.x - width * 0.42, 0, Math.max(0, world.level.width - width)),
      y: clamp(world.player.y - height * 0.58, 0, Math.max(0, world.level.height - height)),
    };
    let shake = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (!isPaused()) {
        world.update(dt, sampleInput());
        const events = world.drainEvents();
        for (const ev of events) {
          if (ev.kind === "player_hit") shake = Math.max(shake, 12);
          else if (ev.kind === "hit") shake = Math.max(shake, ev.data?.heavy ? 7 : 4);
          else if (ev.kind === "enemy_dead") shake = Math.max(shake, 8);
          else if (ev.kind === "parry") shake = Math.max(shake, 10);
          else if (ev.kind === "level_up" || ev.kind === "progression") shake = Math.max(shake, 12);
        }
        if (events.length) onEventsRef.current(events);

        // Smoothed look-ahead camera.
        const lookAhead = world.player.facing * Math.min(150, Math.abs(world.player.vx) * 0.45);
        const tx = clamp(world.player.x + lookAhead - width * 0.47, 0, Math.max(0, world.level.width - width));
        const ty = clamp(world.player.y - height * 0.58, 0, Math.max(0, world.level.height - height));
        const f = Math.min(1, dt * 5.5);
        cam.x += (tx - cam.x) * f;
        cam.y += (ty - cam.y) * f;
        shake = Math.max(0, shake - dt * 30);
      }

      renderer.draw(world, cam, shake);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [world, sampleInput, isPaused, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="game-canvas"
      tabIndex={0}
    />
  );
}
