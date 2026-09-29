import { isSofia } from "../../game/cards";
import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Panels } from "../panels/Panels";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";
import { ModeBox } from "./ModeBox";
import { RpsTable } from "./RpsTable";
import { POS, Seats } from "./Seats";
import { ScorePop } from "./ScorePop";
import type { Seat } from "../../game/types";

export function Table() {
  const g = useGameState();
  /* The anchor orients the felt and is always a seat; `you` is the chair this
     window holds, and the shared table holds none — so it never says "you
     lead" and names the character instead. Read unconditionally, ahead of the
     Rock-Paper-Scissors branch below: React's rule of hooks does not allow a
     hook call to depend on which mode is running. */
  const anchor = useViewSeat();
  const spectating = useSpectating();
  const you: Seat | null = spectating ? null : anchor;
  const { t, seatName } = useI18n();

  /* Rock-Paper-Scissors has no cards, no trick and no seats at play: its own
     felt draws the two throw slots instead. */
  if (g.challenge === "rps") return <RpsTable />;

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
            needed. Politiikka only: the trick Sofia (the ♥Q) just won gets a
            rampage of its own (index.css), and the other three cards in the
            same trick shudder as she hits them. The gate is "the winning slot
            holds the ♥Q", not sofiaIn(g.trick), per the spec's own reading:
            this stays true to "when Sofia wins a trick" even if her rule
            ever changes to let another card win the trick she is in. */}
        {g.trick.map((play) => {
          const sofiaWon =
            g.challenge === "politiikka" &&
            g.winSeat !== null &&
            g.trick.some((p) => p.p === g.winSeat && isSofia(p.card));
          const isWinner = g.winSeat === play.p;
          return (
            <div
              key={play.card.uid}
              className={cx(
                "slot",
                "slot-" + POS[(play.p - anchor + 4) % 4],
                isWinner && "win",
                sofiaWon && isWinner && "sofiarampage",
                sofiaWon && !isWinner && "sofiahit",
              )}
            >
              <PlayingCard card={play.card} className="fresh" />
            </div>
          );
        })}
        {g.pop && <ScorePop pop={g.pop} />}
        <Panels />
      </div>
    </div>
  );
}
