/* ==================== seeded randomness ====================
   All randomness in the game logic goes through an Rng, so the same seed and
   the same player decisions produce the same run. The generator's state lives
   in the game state (g.rngState), not in this module: the reducer has to be
   pure.

   An Rng is a short-lived cursor the reducer creates from the state and writes
   back. Rendering never consumes randomness. */

export type Rng = { next: () => number; state: number };

export function makeRng(seedState: number): Rng {
  const rng: Rng = {
    state: seedState,
    next() {
      /* mulberry32 */
      rng.state = (rng.state + 0x6d2b79f5) | 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  return rng;
}

/* Displayed seeds leave out the confusable O/0 and I/1. */
export const SEED_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* Ainoa sallittu Math.random-kutsu koko projektissa: uuden siemenen arvonta. */
export function makeSeed(): string {
  let out = "";
  for (let i = 0; i < 8; i++)
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  return out;
}

export function seedHash(str: string): number {
  /* FNV-1a */
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/* Any string works as a seed — your own words included. */
export function normalizeSeed(str: string | null | undefined): string {
  const clean = String(str ?? "")
    .trim()
    .toUpperCase();
  return clean || makeSeed();
}

export function pick<T>(rng: Rng, a: readonly T[]): T {
  return a[Math.floor(rng.next() * a.length)];
}

export function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
