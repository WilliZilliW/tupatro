import { useState } from "react";
import { VOUCHERS } from "../../game/content";
import { econOf } from "../../game/economy";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Interpolate } from "../Interpolate";
import { Overlay } from "../Overlay";
import { ReplacePick } from "./ReplacePick";
import { ScoresButton } from "./ScoresModal";
import { cx } from "../cx";
import type { PlayerEconomy, ShopItem } from "../../game/types";

/* Which offers fit as they are. Vouchers are uncapped and permanent, so they
   never compete for a slot and never open the picker. */
function hasRoomFor(e: PlayerEconomy, it: ShopItem): boolean {
  if (it.kind === "joker") return e.jokers.length < e.jokerSlots;
  if (it.kind === "card") return e.sideDeck.length < e.sideSlots;
  if (it.kind === "consumable") return e.consumables.length < e.consSlots;
  return true;
}

function rarityLabel(it: ShopItem, t: ReturnType<typeof useI18n>["t"]): string {
  if (it.kind === "joker") return t(`rarity.${it.data.r}`);
  if (it.kind === "voucher") return t("shop.voucher");
  if (it.kind === "card") return t("shop.card");
  return t("shop.trick");
}

export function Shop() {
  const g = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const { t, nameOf, descOf } = useI18n();
  /* The shelf and the purse of the seat doing the shopping. */
  const e = econOf(g, you);
  const items = e.shop ?? [];
  /* The offer a picker is open for, as a shelf index. Component-local, so a
     reload or leaving the shop simply abandons the pick and nothing about it
     reaches the save. */
  const [pending, setPending] = useState<number | null>(null);
  /* Re-read through the live shelf rather than held as an item: a reroll
     replaces the stock underneath an open picker, and an offer that is gone,
     sold or now fits has nothing left to replace. */
  const pendingItem = pending === null ? null : (items[pending] ?? null);
  const picking =
    pendingItem && !pendingItem.sold && !hasRoomFor(e, pendingItem) ? pendingItem : null;

  return (
    <Overlay>
      <h2>{t("shop.title")}</h2>
      <p className="dek">
        <Interpolate
          text={t("shop.status")}
          slots={{
            money: <b style={{ color: "var(--money)", fontFamily: "var(--font-m)" }}>${e.money}</b>,
            jokers: `${e.jokers.length}/${e.jokerSlots}`,
            tricks: `${e.consumables.length}/${e.consSlots}`,
          }}
        />{" "}
        {t("shop.orderNote")}
        {e.shopAfterBoss && " " + t("shop.voucherNote")}
      </p>

      {picking && pending !== null ? (
        /* Keyed by the offer itself, not by its shelf index: a reroll can put a
           different kind of offer at the same index, and the picker's selection
           is an index into whichever inventory that offer competes for. Without
           the remount a joker pick would survive into a card offer and confirm
           would discard a tuppipakka card the player never chose. */
        <ReplacePick
          key={`${pending}:${picking.kind}:${picking.data.id}`}
          item={picking}
          onConfirm={(replace) => {
            dispatch({ type: "buy", p: you, index: pending, replace });
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      ) : (
        <div className="shelf">
          {items.map((it, i) => {
            const afford = e.money >= it.price && !it.sold;
            const room = hasRoomFor(e, it);
            return (
              <div
                key={it.data.id + i}
                className={cx("item", "kind-" + it.kind, it.sold && "sold")}
              >
                <div className="top">
                  <div className="glyph">{it.data.g}</div>
                  <div>
                    <h4>
                      {nameOf(it.data)}
                      {it.kind === "card" && it.data.cardLabel && " " + it.data.cardLabel}
                    </h4>
                    <div className="rar">
                      {rarityLabel(it, t)}
                      {it.kind === "joker" &&
                        it.data.mode &&
                        " · " + t("shop.modeOnly", { mode: it.data.mode })}
                    </div>
                  </div>
                </div>
                <div className="tx">{descOf(it.data)}</div>
                <button
                  className="buy"
                  disabled={!afford}
                  onClick={() =>
                    room ? dispatch({ type: "buy", p: you, index: i }) : setPending(i)
                  }
                >
                  {it.sold
                    ? t("shop.sold")
                    : room
                      ? t("shop.buy", { price: it.price })
                      : t("shop.buyReplace", { price: it.price })}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {e.vouchers.length > 0 && (
        <p className="dek">
          {t("shop.permanent", {
            list: e.vouchers
              .map((v) => {
                const voucher = VOUCHERS.find((x) => x.id === v);
                return voucher ? nameOf(voucher) : v;
              })
              .join(", "),
          })}
        </p>
      )}

      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "nextBlind" })}>
          {t("btn.nextBlind")}
        </button>
        <button
          className="btn ghost"
          disabled={e.money < e.rerollCost}
          onClick={() => dispatch({ type: "reroll", p: you })}
        >
          {t("btn.reroll", { price: e.rerollCost })}
        </button>
        <ScoresButton />
      </div>
    </Overlay>
  );
}
