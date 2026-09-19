import { useI18n } from "../../i18n/useI18n";
import { Hand } from "../hand/Hand";
import { Panels } from "../panels/Panels";
import { ModeBox } from "./ModeBox";

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
  const { t } = useI18n();
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
        <ModeBox />
        <div className="privstage">
          <Panels />
        </div>
        <Hand />
      </div>
    </div>
  );
}
