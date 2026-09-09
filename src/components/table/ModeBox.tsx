import { teamOf } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import type { Seat } from "../../game/types";

export function ModeBox() {
  const { mode, sooli, ramSeat, ramTeam, sooliSeat } = useGameState();
  const anchor = useViewSeat();
  const spectating = useSpectating();
  const you: Seat | null = spectating ? null : anchor;
  const { t, seatName } = useI18n();

  if (!mode)
    return (
      <div className="modebox">
        <div className="lbl">{t("table.declaration")}</div>
        <div className="val">…</div>
        <div className="note">{t("table.declNote")}</div>
      </div>
    );

  /* A ryosto from where the player sits: the other side declared the rami. The
     shared table sits nowhere, so there is no defending side to name and both
     notes are the neutral ones — the second person is a label written from a
     viewer's point of view exactly as "You" is. */
  const robbery = mode === "rami" && ramTeam !== null && you !== null && ramTeam !== teamOf(you);
  const note = sooli
    ? you === null
      ? t("table.sooliNoteTable", { who: seatName(sooliSeat ?? 0, you) })
      : t("table.sooliNote")
    : mode === "rami"
      ? t(
          you === null
            ? "table.ramiNoteTable"
            : robbery
              ? "table.ramiNoteDefend"
              : "table.ramiNote",
          { who: seatName(ramSeat ?? 0, you) },
        )
      : t("table.noloNote");

  return (
    <div className="modebox">
      <div className="lbl">{t("table.deal")}</div>
      <div className={`val ${mode}`}>{sooli ? "SOOLI" : mode.toUpperCase()}</div>
      <div className="note">{note}</div>
    </div>
  );
}
