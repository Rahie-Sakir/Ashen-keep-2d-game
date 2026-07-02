/**
 * Player session: a lightweight identity persisted in localStorage. The first
 * time a visitor enters a name we register them with the backend and remember
 * the returned id, so saves and scores follow them on return visits.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, type Player } from "./api";

const STORAGE_KEY = "soulsfan-games.player";

interface SessionValue {
  player: Player | null;
  online: boolean;
  signIn: (name: string) => Promise<Player>;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setPlayer(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    api
      .health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const signIn = useCallback(async (name: string) => {
    const registered = await api.registerPlayer(name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registered));
    setPlayer(registered);
    setOnline(true);
    return registered;
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
  }, []);

  const value = useMemo(
    () => ({ player, online, signIn, signOut }),
    [player, online, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within a SessionProvider");
  return value;
}
