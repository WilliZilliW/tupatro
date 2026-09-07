import { teamOf } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

export function ModeBox() {
  const { mode, sooli, ramSeat, ramTeam } = useGameState();
  const you = useViewSeat();
  const { t, seatName } = useI18n();

  if (!mode)
    return (
      <div className="modebox">
        <div className="lbl">{t("table.declaration")}</div>
        <div className="val">…</div>
        <div className="note">{t("table.declNote")}</div>
      </div>
    );

  /* A ryosto from where the player sits: the other side declared the rami. */
  const robbery = mode === "rami" && ramTeam !== null && ramTeam !== teamOf(you);
  const note = sooli
    ? t("table.sooliNote")
    : mode === "rami"
      ? t(robbery ? "table.ramiNoteDefend" : "table.ramiNote", { who: seatName(ramSeat ?? 0, you) })
      : t("table.noloNote");

  return (
    <div className="modebox">
      <div className="lbl">{t("table.deal")}</div>
      <div className={`val ${mode}`}>{sooli ? "SOOLI" : mode.toUpperCase()}</div>
      <div className="note">{note}</div>
    </div>
  );
}
