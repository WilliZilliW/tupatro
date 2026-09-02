export let rngState = 1;

export function rnd() {
  /* mulberry32 */
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/* Näytettävistä siemenistä puuttuvat sekoittuvat merkit O/0 ja I/1. */

/* Näytettävistä siemenistä puuttuvat sekoittuvat merkit O/0 ja I/1. */
export const SEED_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeSeed() {
  let out = "";
  for (let i = 0; i < 8; i++)
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  return out;
}

export function seedHash(str) {
  /* FNV-1a */
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
/* Mikä tahansa merkkijono kelpaa siemeneksi — myös omat sanat. */

/* Mikä tahansa merkkijono kelpaa siemeneksi — myös omat sanat. */
export function setSeed(g, str) {
  const clean = String(str == null ? "" : str)
    .trim()
    .toUpperCase();
  g.seed = clean || makeSeed();
  rngState = seedHash(g.seed) | 0;
}

/* ============================ tila ============================ */

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
/* Soolissa ässä on pienin. */
