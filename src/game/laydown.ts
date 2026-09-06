import type { Card } from "./types";

/* ============================ the laydown ============================
   Tuppi-Rummikub's own rules, and the whole legality of a laydown turn. Pure
   like the rest of the core: everything arrives as a parameter.

   Rummikub's vocabulary, taken from the publisher's rules and pagat.com: a
   group — here a *set* — is three or four tiles of the same number in
   different colours, and a run is three or more consecutive numbers in one
   colour. Suits stand in for colours. A run does not wrap round the end of the
   sequence, and it cannot: a rank is only ever 2..14 and an ace is only ever
   14, which is exactly what makes 12-13-14 a run and 14-2-3 not one. No wrap
   check is needed, and none is written.

   Everything else here — the one-card extension cap and the pip scoring — is
   this game's own, not Rummikub's. See the spec's Source section. */

/* The laydown counts a card at its rank, not at its chip value: an ace is 14
   here and 11 in `chipValue`, and a court card is its own rank rather than a
   flat 10. Two different questions, deliberately two different functions —
   aliasing one to the other would silently rescore every turn. */
export function pipValue(c: Card): number {
  return c.r;
}

export function pipTotal(cards: Card[]): number {
  return cards.reduce((n, c) => n + pipValue(c), 0);
}

/* Three or four cards of one rank, every suit different. Four is the ceiling
   because there are only four suits, and the deck holds one of each card, so
   the distinctness check can only fail on a hand-built pair. */
export function isSet(cards: Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  if (!cards.every((c) => c.r === cards[0].r)) return false;
  return new Set(cards.map((c) => c.s)).size === cards.length;
}

/* Three or more cards of one suit with strictly consecutive ranks. Sorted
   here rather than demanded of the caller, so a row extended at either end is
   the same run however the panel or the AI appended to it. */
export function isRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  if (!cards.every((c) => c.s === cards[0].s)) return false;
  const ranks = cards.map((c) => c.r).sort((a, b) => a - b);
  return ranks.every((r, i) => i === 0 || r - ranks[i - 1] === 1);
}

export function comboOk(cards: Card[]): boolean {
  return isSet(cards) || isRun(cards);
}

/* The proposal is rows of uids, because a turn may rearrange the table as
   well as add to it: what comes back is the table as it would stand. */
export type LayResult = { ok: true; table: Card[][]; laid: Card[] } | { ok: false; key: string };

/* Six rules, one toast key each. The reducer re-runs this rather than
   trusting the panel, so this function is the rule and the panel is a
   convenience. */
export function validateLay(table: Card[][], hand: Card[], combos: string[][]): LayResult {
  const onTable = new Map<string, Card>();
  for (const row of table) for (const c of row) onTable.set(c.uid, c);
  const inHand = new Map<string, Card>();
  for (const c of hand) inHand.set(c.uid, c);

  const seen = new Set<string>();
  const rows: Card[][] = [];
  const laid: Card[] = [];
  for (const row of combos) {
    const cards: Card[] = [];
    for (const uid of row) {
      const card = onTable.get(uid) ?? inHand.get(uid);
      if (!card) return { ok: false, key: "toast.layUnknownCard" };
      if (seen.has(uid)) return { ok: false, key: "toast.layDuplicate" };
      seen.add(uid);
      if (!onTable.has(uid)) laid.push(card);
      cards.push(card);
    }
    rows.push(cards);
  }

  /* The table may be rearranged freely; nothing may leave it. */
  for (const uid of onTable.keys())
    if (!seen.has(uid)) return { ok: false, key: "toast.layTableCardMissing" };

  for (const cards of rows) if (!comboOk(cards)) return { ok: false, key: "toast.layIllegalCombo" };

  /* "At most one card per turn" is read per *combination*, not per turn: the
     requirement qualifies "any combination". A row of entirely new cards may
     be three or more; a row that touches the table takes one card only. */
  for (const cards of rows) {
    const old = cards.filter((c) => onTable.has(c.uid)).length;
    if (old > 0 && cards.length - old > 1) return { ok: false, key: "toast.layOneCard" };
  }

  if (!laid.length) return { ok: false, key: "toast.layNothing" };
  return { ok: true, table: rows, laid };
}
