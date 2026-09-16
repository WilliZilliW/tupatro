import { useI18n } from "../../i18n/useI18n";
import { Panels } from "../panels/Panels";
import { ModeBox } from "./ModeBox";

/* Drawn instead of the felt on a chair-holder's own window while a shared
   table shows the board: everybody looks up at the shared cards and keeps
   their own hand in their hands, so this window has no seats, no trick and no
   score pop to draw — only the declaration box and the phase's own decision
   panel, with Hand and its hint line drawn underneath by App exactly as
   before.

   The box keeps .felt's own grid row rather than giving its space to the
   hand: #declpanel positions and sizes itself against .private the same way
   it does against .felt, so shrinking the row would move the decision panels
   — the one thing this change must not do. */
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
        <Panels />
      </div>
    </div>
  );
}
