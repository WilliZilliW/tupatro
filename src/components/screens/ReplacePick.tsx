import { useState } from "react";
import { cardName, enhOf } from "../../game/cards";
import { econOf } from "../../game/economy";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";
import type { Card, ShopItem } from "../../game/types";

type Props = {
  item: ShopItem;
  onConfirm: (index: number) => void;
  onCancel: () => void;
};

type Held = { key: string; name: string; desc: string; tag?: string; card?: Card };

/* An offer that does not fit is bought by naming what it replaces. The held
   items come before the prose, because the choice is made by reading what each
   one does — the same reason the tuppipakka's cards lead its panel.

   Select then confirm, not a click that discards: the replaced item is
   destroyed and pays nothing back, so a misclick must not be able to spend a
   joker. The selection is an index in this component's own state, never in
   GameState and so never in the save. */
export function ReplacePick({ item, onConfirm, onCancel }: Props) {
  const e = econOf(useGameState(), useViewSeat());
  const { t, nameOf, descOf } = useI18n();
  const [sel, setSel] = useState<number | null>(null);

  /* Which inventory the offer competes for. A voucher is uncapped, so it never
     opens the picker; the empty list keeps this total rather than assuming it. */
  function held(): Held[] {
    if (item.kind === "joker")
      return e.jokers.map((j, i) => ({
        key: `${j.id}-${i}`,
        name: nameOf(j),
        desc: descOf(j),
        tag: j.mode ? t("shop.modeOnly", { mode: j.mode }) : undefined,
      }));
    if (item.kind === "consumable")
      return e.consumables.map((c, i) => ({
        key: `${c.id}-${i}`,
        name: nameOf(c),
        desc: descOf(c),
      }));
    if (item.kind === "card")
      return e.sideDeck.map((c) => {
        /* Every card offer carries an enhancement today, so the bare-card
           fallback is unreachable — but a render path must be total, and
           nameOf(null) would print "undefined". */
        const e = enhOf(c);
        return {
          key: c.uid,
          name: e ? nameOf(e) : cardName(c),
          desc: e ? descOf(e) : cardName(c),
          card: c,
        };
      });
    return [];
  }
  const rows = held();

  return (
    <div className="replacepick">
      <h3>{t("shop.replaceTitle")}</h3>
      <div className="replaceitems">
        {rows.map((h, i) => (
          <div
            key={h.key}
            className={cx("replaceitem", sel === i && "selected")}
            onClick={() => setSel((s) => (s === i ? null : i))}
          >
            {h.card && <PlayingCard card={h.card} twin className="mini" data-uid={h.card.uid} />}
            <div className="ri-text">
              <h4>{h.name}</h4>
              {h.tag && <div className="rar">{h.tag}</div>}
              <div className="tx">{h.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="dek">{t("shop.replaceLead", { name: nameOf(item.data), price: item.price })}</p>
      <p className="fine">{t("shop.replaceFine")}</p>
      <div className="row">
        <button
          className="btn"
          disabled={sel === null}
          onClick={() => sel !== null && onConfirm(sel)}
        >
          {t("btn.doReplace")}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          {t("btn.cancel")}
        </button>
      </div>
    </div>
  );
}
