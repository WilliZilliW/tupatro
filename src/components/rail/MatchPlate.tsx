import { teamOf } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { dealPoints } from "../../game/points";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { usePairLabels } from "../pairLabels";
import type { MatchId } from "../../game/types";

/* The whole rail of a match — either mode — in one plate. Nothing here reads
   money, jokers, the tuppipakka, consumables, the blind or the boss: a match
   has none of them, and a plate that drew a zero would be a lie about a shell
   that is not there. The one number it shares with the main game is `target`,
   which in a match is the match target rather than a blind's.

   The mode is read off the state rather than pinned to the race, because the
   plate has to name the mode it is drawing: the two targets are 12,000 chips
   and 52 points, and a plate that said "Tuppikilpa" over a traditional match
   would name the wrong scale. */
export function MatchPlate() {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const { t, fmt, nameOf } = useI18n();
  const [ours, theirs] = usePairLabels(team);
  const mode: MatchId = g.challenge === "tuppi" ? "tuppi" : "race";
  const row = CHALLENGES.find((c) => c.id === mode) ?? CHALLENGES[0];
  /* What the deal is worth to the viewing pair if it ended on this trick.
     Only the traditional mode draws it: a race has the score pop on the felt
     for per-trick feedback, and this mode has none at all — the tricks are
     worth no chips, so there is nothing for a pop to say. */
  const deal = mode === "tuppi" ? dealPoints(g)[team] : null;

  return (
    <div className="plate chalplate">
      <div className="lbl">{nameOf(row)}</div>
      <div className="chalrowline">
        <span>{t("race.deal", { n: g.raceDeal })}</span>
        <b>
          {t("race.target")} {fmt(g.target)}
        </b>
      </div>
      <div className="chalrowline">
        <span>{ours}</span>
        <b>{fmt(g.raceScores[team])}</b>
      </div>
      <div className="chalrowline">
        <span>{theirs}</span>
        <b>{fmt(g.raceScores[1 - team])}</b>
      </div>
      <div className="chalrowline">
        <span>{t("chal.tricks")}</span>
        <b>
          {g.tricks[team]}–{g.tricks[1 - team]}
        </b>
      </div>
      {deal !== null && (
        <div className="chalrowline">
          <span>{t("matchPlate.dealPoints")}</span>
          <b>{fmt(deal)}</b>
        </div>
      )}
    </div>
  );
}
