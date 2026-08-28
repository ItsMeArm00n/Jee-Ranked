import { createGuestGame, getSnapshot, type GuestBundle, type GuestGame } from "./guest.engine";

const STORAGE_PREFIX = "jee-ranked-guest:";
const games = new Map<string, GuestGame>();

function canStore(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function storageKey(token: string): string {
  return `${STORAGE_PREFIX}${token}`;
}

/**
 * Guest games are deliberately client-only — nothing is written to the backend.
 * We keep the live game in an in-memory Map, backed by sessionStorage so the
 * match survives a page refresh (a full page load loses the in-memory Map).
 */
export function storeGuestBundle(bundle: GuestBundle): void {
  games.set(bundle.token, createGuestGame(bundle));
  if (canStore()) {
    try {
      sessionStorage.setItem(storageKey(bundle.token), JSON.stringify(bundle));
    } catch {
      /* storage unavailable (e.g. private mode) — in-memory only */
    }
  }
}

export function getGuestGame(token: string): GuestGame | null {
  const mem = games.get(token);
  if (mem) return mem;
  if (!canStore()) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(token));
    if (!raw) return null;
    const bundle = JSON.parse(raw) as GuestBundle;
    const game = createGuestGame(bundle);
    games.set(token, game);
    return game;
  } catch {
    return null;
  }
}

export function getGuestSnapshot(token: string): ReturnType<typeof getSnapshot> | null {
  const game = getGuestGame(token);
  return game ? getSnapshot(game) : null;
}

export function hasGuestGame(token: string): boolean {
  return games.has(token);
}
