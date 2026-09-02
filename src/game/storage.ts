/* The only place on the game side that touches localStorage. Everything
   throws in a private window, so every call is guarded. */

const BEST_KEY = "tupatro-best";

export function readBestAnte(): number {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBestAnte(a: number): void {
  try {
    if (a > readBestAnte()) localStorage.setItem(BEST_KEY, String(a));
  } catch {
    /* no storage: the best ante stays known to this session only */
  }
}
