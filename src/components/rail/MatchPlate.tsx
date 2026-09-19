import { teamOf } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { dealPoints } from "../../game/points";
import { matchModeOf } from "../../game/race";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { usePairLabels } from "../pairLabels";

/* The whole rail of a match — any mode — in one plate. Nothing here reads
   money, jokers, the tuppipakka, consumables, the blind or the boss: a match
   has none of them, and a plate that drew a zero would be a lie about a shell
   that is not there. The one number it shares with the main game is `target`,
   which in a match is the match target rather than a blind's.

   The mode is read off the state through the exhaustive helper rather than
   pinned to the race, because the plate has to name the mode it is drawing —
   naming the wrong one would print the wrong target and the wrong label. */
export function MatchPlate() {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const { t, fmt, nameOf } = useI18n();
  const [ours, theirs] = usePairLabels(team);
  const mode = matchModeOf(g.challenge) ?? "race";
  const row = CHALLENGES.find((c) => c.id === mode) ?? CHALLENGES[0];
  /* What the deal is worth to the viewing pair if it ended on this trick.
     Every mode but the race draws it: none of them has a per-trick score pop
     on the felt (a traditional or Tupatro trick is worth no chips at all, and
     a Nami one is scored with no scoreTrick and so no pop either), so this
     line is the only running number they have before the deal ends. A race
     already has the pop for that. The two point-table modes read it off
     dealPoints, which counts tricks; Nami's whole signed value is already in
     raceBase, with nothing further to apply. */
  const isPoints = mode === "tuppi" || mode === "tupatro" || mode === "politiikka";
  const isNami = mode === "nami" || mode === "namihard";
  const deal = isPoints ? dealPoints(g)[team] : isNami ? g.raceBase[team] : null;

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
