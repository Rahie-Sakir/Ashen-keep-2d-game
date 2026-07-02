/**
 * Input manager for keyboard and mouse controls. Translates physical inputs
 * into the game's InputState, distinguishing held movement keys from one-shot
 * action presses (attack, parry, etc.) that should fire once per press.
 */

import { emptyInput, type InputState } from "./types";

const HELD = new Set(["left", "right", "down", "jump"]);

const DEFAULT_BINDINGS: Record<string, keyof InputState> = {
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  KeyS: "down", ArrowDown: "down",
  KeyW: "jump", ArrowUp: "jump", Space: "jump",
  KeyJ: "attack",
  KeyK: "heavy",
  KeyL: "parry",
  ShiftLeft: "roll", ShiftRight: "roll",
  KeyQ: "heal",
  KeyE: "interact",
};

const DEFAULT_MOUSE_BINDINGS: Record<number, keyof InputState> = {
  0: "attack",
  1: "heavy",
  2: "parry",
};

export class InputManager {
  private held = new Set<keyof InputState>();
  private pulses = new Set<keyof InputState>();
  private bindings: Record<string, keyof InputState>;
  private mouseBindings: Record<number, keyof InputState>;
  onPause?: () => void;

  constructor(
    bindings = DEFAULT_BINDINGS,
    mouseBindings = DEFAULT_MOUSE_BINDINGS,
  ) {
    this.bindings = bindings;
    this.mouseBindings = mouseBindings;
  }

  attach(target: Window = window): () => void {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        this.onPause?.();
        return;
      }
      const action = this.bindings[e.code];
      if (!action) return;
      e.preventDefault();
      if (HELD.has(action)) this.held.add(action);
      else if (!this.held.has(action)) {
        this.pulses.add(action);
        this.held.add(action);
      }
    };
    const up = (e: KeyboardEvent) => {
      const action = this.bindings[e.code];
      if (action) this.held.delete(action);
    };
    const mouseDown = (e: MouseEvent) => {
      const action = this.mouseBindings[e.button];
      if (!action) return;
      e.preventDefault();
      if (HELD.has(action)) this.held.add(action);
      else if (!this.held.has(action)) {
        this.pulses.add(action);
        this.held.add(action);
      }
    };
    const mouseUp = (e: MouseEvent) => {
      const action = this.mouseBindings[e.button];
      if (action) this.held.delete(action);
    };
    const contextMenu = (e: MouseEvent) => {
      if (this.mouseBindings[2]) e.preventDefault();
    };
    target.addEventListener("keydown", down);
    target.addEventListener("keyup", up);
    target.addEventListener("mousedown", mouseDown);
    target.addEventListener("mouseup", mouseUp);
    target.addEventListener("contextmenu", contextMenu);
    return () => {
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
      target.removeEventListener("mousedown", mouseDown);
      target.removeEventListener("mouseup", mouseUp);
      target.removeEventListener("contextmenu", contextMenu);
    };
  }

  /** Build this frame's InputState and clear consumed one-shot pulses. */
  sample(): InputState {
    const state = emptyInput();
    for (const action of this.held) {
      if (HELD.has(action)) state[action] = true;
    }
    for (const action of this.pulses) state[action] = true;
    this.pulses.clear();
    return state;
  }

  clear(): void {
    this.held.clear();
    this.pulses.clear();
  }
}
