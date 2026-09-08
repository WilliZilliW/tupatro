import { partnerOf } from "../game/constants";
import { seatOfTeam } from "../game/race";
import { useSpectating } from "../hooks/useNet";
import { useI18n } from "../i18n/useI18n";

/* What to call the two pairs on a race's score rows.

   From a chair the answer is "your side" and "the opponents", which is the
   only useful pair of names when one of them is yours. The shared table has no
   side at all, so both pairs are named by their two characters instead — a
   board on a wall that told the room "Your side: 8,200" would be talking to
   nobody.

   The two labels come back in the order the caller's numbers are in: its own
   team first, the other second. Beside cx.ts rather than in a component,
   because three of them ask the same question — the rail plate, the deal-end
   screen and the race-over screen — and a fourth would otherwise copy it. */
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
