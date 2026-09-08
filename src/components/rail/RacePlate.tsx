import { teamOf } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

/* The whole rail of a race, in one plate. Nothing here reads money, jokers,
   the tuppipakka, consumables, the blind or the boss: a race has none of them,
   and a plate that drew a zero would be a lie about a shell that is not there.
   The one number it shares with the main game is `target`, which in a race is
   the match target rather than a blind's. */
export function RacePlate() {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const { t, fmt, nameOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === "race") ?? CHALLENGES[0];

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
        <span>{t("chal.us")}</span>
        <b>{fmt(g.raceScores[team])}</b>
      </div>
      <div className="chalrowline">
        <span>{t("chal.them")}</span>
        <b>{fmt(g.raceScores[1 - team])}</b>
      </div>
      <div className="chalrowline">
        <span>{t("chal.tricks")}</span>
        <b>
          {g.tricks[team]}–{g.tricks[1 - team]}
        </b>
      </div>
    </div>
  );
}
