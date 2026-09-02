import { SM, SUITS, rankLabel } from "./constants";
import { CONSUMABLES, ENH, ENH_KEYS, JOKERS, VOUCHERS } from "./content";
import { pick, type Rng } from "./rng";
import type { Card, CardOffer, GameState, Joker, ShopItem } from "./types";

/* ============================ the shop ============================
   Rolling the stock is pure: randomness arrives as a parameter, so the same
   seed offers the same selection. Buying and selling live in the reducer,
   because they change state. */

export function rollCardOffer(rng: Rng): CardOffer {
  const enh = pick(rng, ENH_KEYS);
  const e = ENH[enh];
  if (enh === "stone")
    return { id: "card-stone", key: e.key, g: e.g, p: e.p, card: { s: "S", r: 2, enh } };
  const ranks = [14, 13, 12, 11, 10, 9, 5, 4, 3, 2];
  const r = pick(rng, ranks);
  const su = pick(rng, SUITS);
  return {
    id: "card-" + enh + su + r,
    key: e.key,
    /* The rank and suit are appended to the name only at display time, so
       the catalogue holds just the enhancement's name. */
    cardLabel: rankLabel(r) + SM[su].g,
    g: e.g,
    p: e.p,
    card: { s: su, r, enh },
  };
}

type StockState = Pick<GameState, "jokers" | "vouchers" | "shopSlots">;

export function rollShopStock(g: StockState, rng: Rng, afterBoss: boolean): ShopItem[] {
  const owned = new Set(g.jokers.map((j) => j.id));
  const ownedV = new Set(g.vouchers);
  const items: ShopItem[] = [];
  const taken = (id: string) => items.some((x) => x.data.id === id);

  for (let i = 0; i < g.shopSlots; i++) {
    const roll = rng.next();
    /* Balatro: vouchers are offered after a boss. */
    let kind: ShopItem["kind"] =
      roll < 0.46
        ? "joker"
        : roll < 0.74
          ? "card"
          : afterBoss && roll > 0.9
            ? "voucher"
            : "consumable";

    if (kind === "card") {
      const data = rollCardOffer(rng);
      items.push({ kind: "card", data, price: data.p, sold: false });
      continue;
    }
    if (kind === "joker") {
      const src = JOKERS.filter((j) => !owned.has(j.id) && !taken(j.id));
      if (src.length) {
        const data = pick(rng, src);
        items.push({ kind: "joker", data, price: data.p, sold: false });
        continue;
      }
      kind = "consumable";
    }
    if (kind === "voucher") {
      const src = VOUCHERS.filter((v) => !ownedV.has(v.id) && !taken(v.id));
      if (src.length) {
        const data = pick(rng, src);
        items.push({ kind: "voucher", data, price: data.p, sold: false });
        continue;
      }
      kind = "consumable";
    }
    const data = pick(rng, CONSUMABLES);
    items.push({ kind: "consumable", data, price: data.p, sold: false });
  }
  return items;
}

export const jokerSellValue = (j: Joker): number => Math.max(1, Math.ceil(j.p / 2));

export const cardSellValue = (c: Card): number =>
  Math.max(1, Math.ceil((c.enh && ENH[c.enh] ? ENH[c.enh].p : 3) / 2));
