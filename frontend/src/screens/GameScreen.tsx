/**
 * The playable screen. Owns the GameWorld, input, and music; renders the
 * canvas plus React overlays (pause, shrine/level-up, death, victory); and
 * syncs saves and final scores with the backend.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { GameCanvas } from "../game/GameCanvas";
import { MusicEngine } from "../game/audio";
import { InputManager } from "../game/input";
import { WEAPONS } from "../game/weapons";
import { GameWorld } from "../game/world";
import type { GameEvent } from "../game/types";
import { useSession } from "../session";

type Overlay = "none" | "pause" | "shrine" | "dead" | "victory";

export function GameScreen() {
  const { player } = useSession();
  const navigate = useNavigate();

  const worldRef = useRef<GameWorld>();
  if (!worldRef.current) worldRef.current = new GameWorld();
  const inputRef = useRef<InputManager>();
  const musicRef = useRef<MusicEngine>();
  const scoredRef = useRef(false);

  const [overlay, setOverlay] = useState<Overlay>("none");
  const overlayRef = useRef<Overlay>("none");
  overlayRef.current = overlay;
  const [, forceRender] = useReducer((n) => n + 1, 0);

  // Boot: load save, wire input + music.
  useEffect(() => {
    const world = worldRef.current!;
    const input = new InputManager();
    inputRef.current = input;
    const music = new MusicEngine();
    musicRef.current = music;

    input.onPause = () => {
      setOverlay((cur) => (cur === "none" ? "pause" : cur === "pause" ? "none" : cur));
    };
    const detach = input.attach();

    if (player) {
      api.getSave(player.id).then((save) => {
        if (save) world.loadSave(save.state as ReturnType<GameWorld["toSave"]>);
        music.play(world.level.id);
      });
    } else {
      music.play(world.level.id);
    }

    return () => {
      detach();
      music.stop();
    };
  }, [player]);

  const persistSave = useCallback(() => {
    if (!player) return;
    api.putSave(player.id, worldRef.current!.toSave()).catch(() => undefined);
  }, [player]);

  const submitScore = useCallback(
    (victory: boolean) => {
      if (!player || scoredRef.current) return;
      scoredRef.current = true;
      const world = worldRef.current!;
      api
        .submitScore({
          playerId: player.id,
          echoes: world.player.echoes,
          levelReached: world.levelIndex + 1,
          timeSeconds: Math.max(1, Math.round(world.gameTime)),
          victory,
        })
        .catch(() => undefined);
    },
    [player],
  );

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      for (const ev of events) {
        switch (ev.kind) {
          case "save_requested":
            persistSave();
            break;
          case "level_changed":
            musicRef.current?.play(worldRef.current!.level.id);
            break;
          case "rest":
            setOverlay("shrine");
            break;
          case "player_dead":
            setOverlay("dead");
            break;
          case "game_complete":
            submitScore(true);
            setOverlay("victory");
            break;
        }
      }
    },
    [persistSave, submitScore],
  );

  const sampleInput = useCallback(() => inputRef.current!.sample(), []);
  const isPaused = useCallback(() => overlayRef.current !== "none", []);

  function resume() {
    inputRef.current?.clear();
    setOverlay("none");
  }

  function quitToTitle() {
    persistSave();
    musicRef.current?.stop();
    navigate("/");
  }

  function reform() {
    worldRef.current!.respawn();
    resume();
  }

  return (
    <div className="game-stage">
      <GameCanvas
        world={worldRef.current}
        sampleInput={sampleInput}
        isPaused={isPaused}
        onEvents={handleEvents}
      />

      {overlay === "pause" && (
        <Overlay title="PILGRIMAGE PAUSED">
          <button className="btn btn--primary" onClick={resume}>RETURN</button>
          <button className="btn" onClick={persistSave}>SAVE MEMORY</button>
          <MusicButton music={musicRef.current} />
          <button className="btn btn--ghost" onClick={quitToTitle}>SAVE &amp; TITLE</button>
        </Overlay>
      )}

      {overlay === "shrine" && (
        <ShrineMenu world={worldRef.current} onChange={forceRender} onClose={resume} />
      )}

      {overlay === "dead" && (
        <Overlay title="VESSEL BROKEN">
          <p className="hint">The checkpoint keeps your shape. Echoes scatter on death.</p>
          <button className="btn btn--primary" onClick={reform}>REFORM AT THE EMBER</button>
          <button className="btn btn--ghost" onClick={quitToTitle}>RETURN TO TITLE</button>
        </Overlay>
      )}

      {overlay === "victory" && (
        <Overlay title="THE LONG DAWN">
          <p className="hint">All three levels cleared. Your finish time was submitted.</p>
          <button className="btn btn--primary" onClick={() => navigate("/leaderboard")}>
            LEADERBOARD
          </button>
          <button className="btn btn--ghost" onClick={quitToTitle}>RETURN TO TITLE</button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overlay">
      <div className="panel">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function MusicButton({ music }: { music?: MusicEngine }) {
  const [on, setOn] = useState(music?.enabled ?? true);
  return (
    <button
      className="btn"
      onClick={() => {
        setOn(music?.toggle() ?? on);
      }}
    >
      MUSIC: {on ? "ON" : "OFF"}
    </button>
  );
}

function ShrineMenu({
  world,
  onChange,
  onClose,
}: {
  world: GameWorld;
  onChange: () => void;
  onClose: () => void;
}) {
  const p = world.player;
  const cost = world.upgradeCost();
  const canAfford = p.echoes >= cost;

  const upgrade = (stat: "vitality" | "endurance" | "strength") => {
    world.purchaseUpgrade(stat);
    world.drainEvents();
    onChange();
  };
  const equip = (weaponId: string) => {
    world.equipWeapon(weaponId);
    onChange();
  };

  return (
    <div className="overlay">
      <div className="panel">
        <h2>MEMORY EMBER</h2>
        <p className="hint">
          Level {p.characterLevel} · Echoes {p.echoes} · Next level {cost}
        </p>
        <button className="btn" disabled={!canAfford} onClick={() => upgrade("vitality")}>
          VITALITY · +10 MAX HEALTH
        </button>
        <button className="btn" disabled={!canAfford} onClick={() => upgrade("endurance")}>
          ENDURANCE · +8 MAX STAMINA
        </button>
        <button className="btn" disabled={!canAfford} onClick={() => upgrade("strength")}>
          STRENGTH · +6% BLADE POWER
        </button>
        <h2 style={{ fontSize: "1rem", marginTop: "0.6rem" }}>ARMAMENT</h2>
        {Object.values(WEAPONS).map((w) => {
          const unlocked = p.unlockedWeapons.includes(w.id);
          const equipped = p.weapon === w.id;
          return (
            <button
              key={w.id}
              className={equipped ? "btn btn--primary" : "btn"}
              disabled={!unlocked || equipped}
              onClick={() => equip(w.id)}
            >
              {w.name}
              {equipped ? " · IN HAND" : unlocked ? "" : " · SEALED"}
            </button>
          );
        })}
        <button className="btn btn--ghost" onClick={onClose}>CONTINUE</button>
      </div>
    </div>
  );
}
