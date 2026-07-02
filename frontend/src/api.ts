/**
 * Thin typed wrapper over the Express REST API. All calls are relative to
 * /api so the Vite dev proxy (or a same-origin deploy) routes them to the
 * backend.
 */

export interface Player {
  id: string;
  name: string;
  createdAt: string;
}

export interface SaveState {
  version: number;
  levelIndex: number;
  checkpoint: [number, number, number];
  defeatedBosses: string[];
  gameTime: number;
  victory: boolean;
  player: {
    health: number;
    maxHealth: number;
    stamina: number;
    maxStamina: number;
    attackPower: number;
    characterLevel: number;
    echoes: number;
    weapon: string;
    unlockedWeapons: string[];
  };
}

export interface SaveDoc {
  playerId: string;
  state: SaveState;
  updatedAt: string;
}

export interface Score {
  id: string;
  playerId: string;
  name: string;
  echoes: number;
  levelReached: number;
  timeSeconds: number;
  victory: boolean;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  registerPlayer: (name: string) =>
    request<Player>("/players", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getSave: (playerId: string) =>
    request<SaveDoc>(`/saves/${playerId}`).catch(() => null),

  putSave: (playerId: string, state: SaveState) =>
    request<SaveDoc>(`/saves/${playerId}`, {
      method: "PUT",
      body: JSON.stringify({ state }),
    }),

  deleteSave: (playerId: string) =>
    request<void>(`/saves/${playerId}`, { method: "DELETE" }),

  getLeaderboard: (limit = 20) =>
    request<Score[]>(`/leaderboard?limit=${limit}`),

  submitScore: (entry: {
    playerId: string;
    echoes: number;
    levelReached: number;
    timeSeconds: number;
    victory: boolean;
  }) =>
    request<Score>("/leaderboard", {
      method: "POST",
      body: JSON.stringify(entry),
    }),
};
