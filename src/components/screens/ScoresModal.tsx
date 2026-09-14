import { readScores } from "../../game/storage";
import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Scoreboard } from "./Scoreboard";

/* The board a player opens mid-run, from the rail. Finished runs only: the run
   in progress has no result yet, so the display-time merge the two end screens
   do — where the run is over — is deliberately not repeated here. */
export function ScoresModal() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <Overlay>
      <Scoreboard rows={readScores()} />
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}

/* The way in from a flow-driven screen. .overlay is fixed and covers the whole
   viewport, so the rail's SCORES button is unreachable whenever one is up —
   the same reason the blind select and the game-over screen carry their own
   Rules buttons. It is not on every such overlay, though: the four that hide a
   running deal without drawing the board carry one — BlindSelect, Shop,
   DealEnd and CashOut — and so does SinglePlayer, which is where the board is
   reached away from a game. The start menu deliberately carries none, because
   the board is the solo roguelike's own top ten and belongs behind the Single
   player door with the run it records. */
export function ScoresButton() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <button className="btn ghost" onClick={() => dispatch({ type: "openModal", modal: "scores" })}>
      {t("btn.scores")}
    </button>
  );
}
