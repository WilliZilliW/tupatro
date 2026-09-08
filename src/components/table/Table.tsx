import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Panels } from "../panels/Panels";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";
import { ModeBox } from "./ModeBox";
import { POS, Seats } from "./Seats";
import { ScorePop } from "./ScorePop";
import type { Seat } from "../../game/types";

export function Table() {
  const g = useGameState();
  /* The anchor orients the felt and is always a seat; `you` is the chair this
     window holds, and the shared table holds none — so it never says "you
     lead" and names the character instead. */
  const anchor = useViewSeat();
  const spectating = useSpectating();
  const you: Seat | null = spectating ? null : anchor;
  const { t, seatName } = useI18n();

  const centerMsg =
    g.trick.length || g.phase !== "play"
      ? ""
      : g.turn === you
        ? t("table.youLead")
        : t("table.theyLead", { who: seatName(g.turn, you) });

  return (
    <div className="tablewrap">
      <div className="felt">
        <ModeBox />
        <div className="center-msg">{centerMsg}</div>
        <Seats />
        {/* uid as the key: each card mounts exactly once, so the CSS drop
            animation plays then and no "already animated" bookkeeping is
            needed. */}
        {g.trick.map((play) => (
          <div
            key={play.card.uid}
            className={cx(
              "slot",
              "slot-" + POS[(play.p - anchor + 4) % 4],
              g.winSeat === play.p && "win",
            )}
          >
            <PlayingCard card={play.card} className="fresh" />
          </div>
        ))}
        {g.pop && <ScorePop pop={g.pop} />}
        <Panels />
      </div>
    </div>
  );
}
