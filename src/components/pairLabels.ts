import { partnerOf, teamOf } from "../game/constants";
import { seatOfTeam } from "../game/race";
import { rpsSeats } from "../game/rps";
import { useSpectating } from "../hooks/useNet";
import { useI18n } from "../i18n/useI18n";
import type { GameState } from "../game/types";

/* What to call the two pairs on a race's score rows.

   From a chair the answer is "your side" and "the opponents", which is the
   only useful pair of names when one of them is yours. The shared table has no
   side at all, so both pairs are named by their two characters instead — a
   board on a wall that told the room "Your side: 8,200" would be talking to
   nobody.

   The two labels come back in the order the caller's numbers are in: its own
   team first, the other second. Beside cx.ts rather than in a component,
   because four of them ask the same question — the match's rail plate, the
   deal-end screen, the race-over screen and the main game's `Tally`, which
   takes the spectating half only and keeps its own "Me" / "He" from a chair.

   The from-a-chair half is the race's pair of words, so a caller whose chair
   labels differ picks between the two itself rather than widening this. */
export function usePairLabels(team: 0 | 1): [string, string] {
  const { t, seatName } = useI18n();
  const spectating = useSpectating();
  if (!spectating) return [t("chal.us"), t("chal.them")];
  const pair = (x: 0 | 1) => {
    const seat = seatOfTeam(x);
    return t("race.pair", { a: seatName(seat, null), b: seatName(partnerOf(seat), null) });
  };
  return [pair(team), pair(team === 0 ? 1 : 0)];
}

/* The same question for Rock-Paper-Scissors' two sides, and a second function
   rather than a mode of the one above because the mode seats two *seats*, not
   two pairs: chairs 2 and 3 play nobody, so "Seija & Veikko" would name a
   partner who is not in the match.

   From a chair the answer is the mode's own two words, "You" and "Opponent" —
   both true whether the other side is a person or the game. A shared display
   is neither side, so each is named by the character sitting in it instead,
   exactly as a race's two pairs are: a board on a wall reading "You 3 – 1"
   would be talking to nobody, and "Sinä" is the one word the table sweep in
   render.test.tsx forbids on every other screen.

   Team-indexed, like rpsCards and rpsWins, and returned in the caller's own
   order — its own team first — so every call site reads as it did with the two
   catalogue strings inlined. */
export function useRpsLabels(g: GameState, team: 0 | 1): [string, string] {
  const { t, seatName } = useI18n();
  const spectating = useSpectating();
  if (!spectating) return [t("rps.you"), t("rps.opponent")];
  const seats = rpsSeats(g);
  const side = (x: 0 | 1) => seatName(teamOf(seats[0]) === x ? seats[0] : seats[1], null);
  return [side(team), side(team === 0 ? 1 : 0)];
}
