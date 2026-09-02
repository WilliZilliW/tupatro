import { VOUCHERS } from "../../game/content";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Interpolate } from "../Interpolate";
import { Overlay } from "../Overlay";
import { cx } from "../cx";
import type { ShopItem } from "../../game/types";

function rarityLabel(it: ShopItem, t: ReturnType<typeof useI18n>["t"]): string {
  if (it.kind === "joker") return t(`rarity.${it.data.r}`);
  if (it.kind === "voucher") return t("shop.voucher");
  if (it.kind === "card") return t("shop.card");
  return t("shop.trick");
}

export function Shop() {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, nameOf, descOf } = useI18n();
  const items = g.shop ?? [];

  return (
    <Overlay>
      <h2>{t("shop.title")}</h2>
      <p className="dek">
        <Interpolate
          text={t("shop.status")}
          slots={{
            money: <b style={{ color: "var(--money)", fontFamily: "var(--font-m)" }}>${g.money}</b>,
            jokers: `${g.jokers.length}/${g.jokerSlots}`,
            tricks: `${g.consumables.length}/${g.consSlots}`,
          }}
        />{" "}
        {t("shop.orderNote")}
        {g.shopAfterBoss && " " + t("shop.voucherNote")}
      </p>

      <div className="shelf">
        {items.map((it, i) => {
          const afford = g.money >= it.price && !it.sold;
          return (
            <div key={it.data.id + i} className={cx("item", "kind-" + it.kind, it.sold && "sold")}>
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
                onClick={() => dispatch({ type: "buy", index: i })}
              >
                {it.sold ? t("shop.sold") : t("shop.buy", { price: it.price })}
              </button>
            </div>
          );
        })}
      </div>

      {g.vouchers.length > 0 && (
        <p className="dek">
          {t("shop.permanent", {
            list: g.vouchers
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
          disabled={g.money < g.rerollCost}
          onClick={() => dispatch({ type: "reroll" })}
        >
          {t("btn.reroll", { price: g.rerollCost })}
        </button>
      </div>
    </Overlay>
  );
}
