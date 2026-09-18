import { RPS_WINS, teamOf } from "../../game/constants";
import { beats } from "../../game/rps";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Panels } from "../panels/Panels";

/* Instead of the ordinary felt for a mode with no cards at all: two throw
   slots, the round score against RPS_WINS, the round number, and — once both
   throws are in — the decided round's outcome, computed from beats() rather
   than stored (see rpsThrows's own comment in types.ts: there is
   deliberately no "last result" field). Both throws sit in state from the
   moment the round starts, but this only reads them once the phase is
   rpsreveal, so the felt never shows the opponent's committed throw before
   the player's own — that is a UI choice, not a rule: the throw is readable
   in devtools like every hand in this project already is. */
export function RpsTable() {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const { t, fmt } = useI18n();

  const revealed = g.phase === "rpsreveal";
  const mine = revealed ? g.rpsThrows[team] : null;
  const theirs = revealed ? g.rpsThrows[1 - team] : null;
  const tie = mine !== null && theirs !== null && mine === theirs;
  const won = mine !== null && theirs !== null && beats(mine, theirs);

  return (
    <div className="tablewrap">
      <div className="felt">
        <div className="rpsboard">
          <div className="rpsscore">
            {fmt(g.rpsWins[team])}–{fmt(g.rpsWins[1 - team])}
          </div>
          <div className="rpsline">{t("rps.round", { n: g.rpsRound + 1 })}</div>
          <div className="rpsline">{t("rps.target", { n: RPS_WINS })}</div>
          <div className="rpsrow">
            <span>
              {t("rps.you")}: <b>{mine ? t(`rps.throw.${mine}`) : t("rps.hidden")}</b>
            </span>
            <span>
              {t("rps.opponent")}: <b>{theirs ? t(`rps.throw.${theirs}`) : t("rps.hidden")}</b>
            </span>
          </div>
          {revealed && (
            <div className="rpsoutcome">
              {tie ? t("rps.tied") : won ? t("rps.roundWon") : t("rps.roundLost")}
            </div>
          )}
        </div>
        <Panels />
      </div>
    </div>
  );
}
