import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";

/* Raised by the single-player screen's new-run button, and only when there is
   a run to lose: newRun replaces the whole state, the parked run a challenge
   left behind included, so it is the one click on that screen that confirms.
   Cancelling returns to the single-player screen, because g.menu is still
   "single" underneath — the ghost button says Cancel, where "Continue" would
   be a promise it does not keep.

   The confirmation dispatches the run itself. It carries no seed and no seat:
   the reducer draws the seed and builds the seat-0 single-player board, which
   is what every seedless newRun in the app produces, and useSeatSync moves the
   window to it. The lobby's Start is a different door with a different action
   — the session composes that one from the chairs — and it starts no
   roguelike at all. */
export function RestartConfirm() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("restart.title")}</h2>
      <p className="dek">{t("restart.body")}</p>
      <div className="row">
        {/* A MoveButton for the same reason the seed dialog's two are: every
            modal is a local action away, so no screen may hold a live newRun
            that a table window could click. */}
        <MoveButton className="btn" onClick={() => dispatch({ type: "newRun" })}>
          {t("btn.yesRestart")}
        </MoveButton>
        <button className="btn ghost" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.cancel")}
        </button>
      </div>
    </Overlay>
  );
}
