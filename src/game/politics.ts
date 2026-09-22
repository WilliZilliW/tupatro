import { isSofia } from "./cards";
import type { Mode, TrickPlay } from "./types";

/* ============================ Politiikka ============================
   Neither source knows this mode: the Oulunsalo senior tuppi club rule sheet
   (Antti Auer, 9 September 2022) and korttipeliopas.fi both make the
   rami/nolo declaration a free clockwise choice, and neither gives any card
   an effect or a government any weight. This mode contradicts both on
   purpose — GitHub issues #49 and #63, merged into this one mode on
   2026-09-20 (see docs/specs/2026-09-20-combine-politics-modes.md) — and
   ships the way Tuppi-Rummikub's laydown, Nami's point tables and
   Rock-Paper-Scissors' two clubs do: as this game's own invention, stated so
   in the rules panel and the README.

   This file and puolue.ts are Politiikka's two arithmetics, one mode split
   across two files the way points.ts and nami.ts are not split at all —
   this one holds the rotation and the Sofia rule, puolue.ts the government
   and the party-capture scale, because merging them would move every import
   for no rule change. No wallet, no boss, no base — the same shape
   points.ts, nami.ts and rps.ts have, so this stays part of the pure core
   and is testable with no reducer at all. */

/* The rotation: deal 1 is a hallituspeli (rami, "both pairs want tricks"),
   deal 2 an oppositiopeli (nolo, "both pairs dodge them"), and so on for as
   long as the match lasts. Nothing in the issues says which comes first; the
   government is named first in the chat and that is the whole reason odd
   deals are rami. Keyed off raceDeal, which is already state and already
   saved, so a resumed match continues the rotation where it left off rather
   than restarting it. puolue.ts reads this function directly rather than
   defining a second copy of the odd/even test — GitHub issue #63's "joka
   toinen kierros on rami ja joka toinen nolo" is the identical rotation. */
export function politicsMode(dealNo: number): Mode {
  return dealNo % 2 === 1 ? "rami" : "nolo";
}

/* "Is the loud one in this trick" — the one question the Sofia rule needs
   answered. She is this game's own invention: neither source gives the ♥Q,
   or any card, an effect at all. Two alternatives were considered and
   rejected in writing (see the spec): voiding the trick would leave twelve
   counted tricks, which breaks the termination proof's assumption that all
   52 cards are captured across exactly thirteen tricks a deal, and ending
   the deal early would leave hands uneven. Taking the trick is the only
   reading that keeps the deal whole, so she is a rule, not a bonus — every
   card is still played, and her side always wins exactly one trick more
   than its cards would otherwise take. She is still an ordinary card for
   capture scoring: puolue.ts's puolueValue reads her value from her own
   party like any other card's, with no exemption and no bonus. */
export function sofiaIn(trick: TrickPlay[]): TrickPlay | null {
  return trick.find((t) => isSofia(t.card)) ?? null;
}
