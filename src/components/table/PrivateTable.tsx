import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Hand } from "../hand/Hand";
import { Panels } from "../panels/Panels";
import { ModeBox } from "./ModeBox";
import { RpsBoard } from "./RpsTable";

/* Drawn instead of the felt on a chair-holder's own window while a shared
   table shows the board: everybody looks up at the shared cards and keeps
   their own hand in their hands, so this window has no seats, no trick and no
   score pop to draw — only the declaration box, the phase's own decision
   panel and, since issue #57, the player's own hand: it is drawn *inside*
   this frame now, in the area the felt normally occupies, rather than left
   beneath it in #app's own hand row.

   .private is a flex column: .privstage (the panel's containing block) takes
   whatever height the hand does not need, then .handzone sits beneath it at
   its ordinary, unchanged size. #declpanel positions and sizes itself
   against .privstage the same way it used to size itself against .private —
   the panel's own room is the one thing this change must not shrink — and
   .privbar / ModeBox keep their absolute corners against .private itself. */
export function PrivateTable({ onShowBoard }: { onShowBoard: () => void }) {
  const g = useGameState();
  const { t } = useI18n();
  /* Rock-Paper-Scissors has no declaration box and no decision panel — its
     one decision is a hand click, and Panels() already draws nothing for
     rpsthrow — so its felt (RpsBoard, shared with RpsTable) takes the stage
     in place of both, rather than sitting beside an empty ModeBox. */
  const rps = g.challenge === "rps";
  return (
    <div className="tablewrap">
      <div className="private">
        <div className="privbar">
          <p>{t("priv.note")}</p>
          {/* Window-local and never on GameState: it moves nothing, so it is
              a plain button rather than a MoveButton. */}
          <button type="button" onClick={onShowBoard}>
            {t("btn.showBoard")}
          </button>
        </div>
        {!rps && <ModeBox />}
        <div className="privstage">{rps ? <RpsBoard /> : <Panels />}</div>
        <Hand />
      </div>
    </div>
  );
}
