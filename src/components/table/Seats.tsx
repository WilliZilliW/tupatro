import { cardName, rv } from "../../game/cards";
import { SEATS } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import type { Seat } from "../../game/types";

export const POS = ["s", "w", "n", "e"] as const;

export function Seats() {
  const g = useGameState();
  const { t, seatName } = useI18n();

  return (
    <>
      {([0, 1, 2, 3] as Seat[]).map((p) => {
        const sitOut = g.sooli && p === 2;
        const sh = g.shows[p];
        const info = sitOut
          ? t("table.sitOut")
          : g.reveal && p !== 0
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
              "seat-" + POS[p],
              p === 0 && "us",
              p === 2 && "mate",
              g.turn === p && g.phase === "play" && "active",
              sitOut && "out",
            )}
          >
            <div className="av">{SEATS[p].short}</div>
            <div>
              <div className="who">
                {seatName(p)}
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
