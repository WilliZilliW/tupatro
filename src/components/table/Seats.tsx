import { cardName, rv } from "../../game/cards";
import { SEATS, partnerOf, sameTeam } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import type { Seat } from "../../game/types";

/* The four places on the felt, clockwise from the bottom. A seat is drawn at
   POS[(p - you + 4) % 4]: the viewing seat sits at the bottom and the rest
   fall clockwise from it. That is the identity at you === 0, which is where
   single player sits. Table.tsx places the trick slots the same way. */
export const POS = ["s", "w", "n", "e"] as const;

export function Seats() {
  const g = useGameState();
  /* Two different questions, and the shared table answers them differently.
     `anchor` is where the felt is drawn from and is always a seat, or POS's
     arithmetic would be NaN; `you` is whose chair this window holds, and the
     table holds none. */
  const anchor = useViewSeat();
  const spectating = useSpectating();
  const you: Seat | null = spectating ? null : anchor;
  const { t, seatName } = useI18n();

  return (
    <>
      {([0, 1, 2, 3] as Seat[]).map((p) => {
        const sitOut = g.sooli && g.sooliSeat !== null && p === partnerOf(g.sooliSeat);
        const sh = g.shows[p];
        /* The reveal is one player's peek at the other hands, so it is not the
           shared table's: every chair there shows a count, whatever the deal
           has turned face up. */
        const info = sitOut
          ? t("table.sitOut")
          : !spectating && g.reveal && p !== you
            ? g.hands[p]
                .slice()
                .sort((a, b) => rv(g, b) - rv(g, a))
                .map(cardName)
                .join(" ")
            : t("table.cardCount", { n: g.hands[p].length });

        return (
          <div
            key={p}
            className={cx(
              "seat",
              "seat-" + POS[(p - anchor + 4) % 4],
              p === you && "us",
              you !== null && p !== you && sameTeam(p, you) && "mate",
              g.turn === p && g.phase === "play" && "active",
              sitOut && "out",
            )}
          >
            <div className="av">{SEATS[p].short}</div>
            <div>
              <div className="who">
                {seatName(p, you)}
                {g.dealer === p && <span className="dealerchip">{t("table.dealer")}</span>}
                {sh && (
                  <span className={`showchip ${sh.decl}`}>
                    {sh.decl.toUpperCase()} {sh.card ? cardName(sh.card) : t("table.saidOnly")}
                  </span>
                )}
              </div>
              <div className="sub">{info}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}
