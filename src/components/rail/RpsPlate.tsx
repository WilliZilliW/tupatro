import { RPS_ROUNDS, teamOf } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

/* The whole rail of a Rock-Paper-Scissors match, in one plate — the
   ChallengePlate's own shape, with no tricks and no laydown to report: three
   rounds have only the round number and the two win counts. */
export function RpsPlate() {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const { t, fmt, nameOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === "rps") ?? CHALLENGES[0];

  return (
    <div className="plate chalplate">
      <div className="lbl">{nameOf(row)}</div>
      {/* The round number is capped at the last round: the phase stays
          rpsreveal while the result screen is up, and rpsRound has already
          been incremented past the third round by then. */}
      <div className="chalrowline">
        <b>
          {t("rps.round", { n: fmt(Math.min(g.rpsRound + 1, RPS_ROUNDS)), total: fmt(RPS_ROUNDS) })}
        </b>
      </div>
      <div className="chalrowline">
        <span>{t("rps.you")}</span>
        <b>{fmt(g.rpsWins[team])}</b>
      </div>
      <div className="chalrowline">
        <span>{t("rps.opponent")}</span>
        <b>{fmt(g.rpsWins[1 - team])}</b>
      </div>
    </div>
  );
}
