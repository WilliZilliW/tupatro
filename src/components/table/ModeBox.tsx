import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

export function ModeBox() {
  const { mode, sooli, ramSeat, ramTeam } = useGameState();
  const { t, seatName } = useI18n();

  if (!mode)
    return (
      <div className="modebox">
        <div className="lbl">{t("table.declaration")}</div>
        <div className="val">…</div>
        <div className="note">{t("table.declNote")}</div>
      </div>
    );

  const robbery = mode === "rami" && ramTeam === 1;
  const note = sooli
    ? t("table.sooliNote")
    : mode === "rami"
      ? t(robbery ? "table.ramiNoteDefend" : "table.ramiNote", { who: seatName(ramSeat ?? 0) })
      : t("table.noloNote");

  return (
    <div className="modebox">
      <div className="lbl">{t("table.deal")}</div>
      <div className={`val ${mode}`}>{sooli ? "SOOLI" : mode.toUpperCase()}</div>
      <div className="note">{note}</div>
    </div>
  );
}
