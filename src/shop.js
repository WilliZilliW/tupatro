import { mkCard } from "./cards.js";
import { SM, SUITS, rankLabel } from "./constants.js";
import { nameOf, t } from "./i18n.js";
import { CONSUMABLES, ENH, JOKERS, VOUCHERS } from "./content.js";
import { rnd } from "./rng.js";
import { G } from "./state.js";
import { toast } from "./ui/dom.js";
import { render } from "./ui/render.js";
import { renderSwapPanel, showShop } from "./ui/screens.js";

/* ============================ raha & kauppa ============================ */
export function rollCardOffer() {
  const keys = ["stone", "wild", "steel", "glass", "bonus", "mult", "gold"];
  const enh = keys[Math.floor(rnd() * keys.length)];
  const e = ENH[enh];
  if (enh === "stone")
    return { id: "card-stone", key: e.key, g: e.g, p: e.p, card: { s: "S", r: 2, enh: enh } };
  const ranks = [14, 13, 12, 11, 10, 9, 5, 4, 3, 2];
  const r = ranks[Math.floor(rnd() * ranks.length)];
  const su = SUITS[Math.floor(rnd() * 4)];
  return {
    id: "card-" + enh + su + r,
    key: e.key,
    /* Kortin arvo ja maa liitetään nimen perään vasta näytettäessä, jotta
       kielitiedosto sisältää vain jalosteen nimen. */
    cardLabel: rankLabel(r) + SM[su].g,
    g: e.g,
    p: e.p,
    card: { s: su, r: r, enh: enh },
  };
}

export function rollShop(afterBoss) {
  const owned = new Set(G.jokers.map((j) => j.id));
  const ownedV = new Set(G.vouchers);
  const items = [];
  for (let i = 0; i < G.shopSlots; i++) {
    const roll = rnd();
    /* Balatro: kuponkeja tarjotaan pomon jälkeen. */
    let kind =
      roll < 0.46
        ? "joker"
        : roll < 0.74
          ? "card"
          : afterBoss && roll > 0.9
            ? "voucher"
            : "consumable";
    if (kind === "card") {
      items.push({ kind, data: rollCardOffer(), price: 0, sold: false });
      continue;
    }
    let src;
    if (kind === "joker") {
      src = JOKERS.filter((j) => !owned.has(j.id) && !items.some((x) => x.data.id === j.id));
      if (!src.length) kind = "consumable";
    }
    if (kind === "voucher") {
      src = VOUCHERS.filter((v) => !ownedV.has(v.id) && !items.some((x) => x.data.id === v.id));
      if (!src.length) kind = "consumable";
    }
    if (kind === "consumable") src = CONSUMABLES;
    items.push({ kind, data: src[Math.floor(rnd() * src.length)], price: 0, sold: false });
  }
  items.forEach((it) => (it.price = it.data.p));
  G.shop = items;
  G.shopAfterBoss = !!afterBoss;
  G.rerollCost = 5;
}

export function buy(idx) {
  const it = G.shop[idx];
  if (!it || it.sold || G.money < it.price) return;
  if (it.kind === "joker" && G.jokers.length >= G.jokerSlots) {
    toast(t("toast.jokerSlotsFull"));
    return;
  }
  if (it.kind === "card" && G.sideDeck.length >= G.sideSlots) {
    toast(t("toast.sideDeckFull"));
    return;
  }
  if (it.kind === "consumable" && G.consumables.length >= G.consSlots) {
    toast(t("toast.trickSlotsFull"));
    return;
  }
  G.money -= it.price;
  it.sold = true;
  if (it.kind === "joker") G.jokers.push(it.data);
  else if (it.kind === "card")
    G.sideDeck.push(mkCard(it.data.card.s, it.data.card.r, it.data.card.enh));
  else if (it.kind === "consumable") G.consumables.push(it.data);
  else {
    G.vouchers.push(it.data.id);
    if (it.data.id === "teroitin") G.chipBonus += 3;
    if (it.data.id === "tuppisormus") G.tuppiBonus += 1;
    if (it.data.id === "kahvipannu") G.jokerSlots += 1;
    if (it.data.id === "muistikirja") {
      G.consSlots += 1;
      G.shopSlots += 1;
    }
    if (it.data.id === "hihalaukku") G.swaps += 1;
    if (it.data.id === "isompipakka") G.sideSlots += 1;
  }
  showShop();
  render();
}

export function sellJoker(i) {
  const j = G.jokers[i];
  const v = Math.max(1, Math.ceil(j.p / 2));
  G.money += v;
  G.jokers.splice(i, 1);
  toast(t("toast.soldJoker", { name: nameOf(j), amount: v }));
  render();
  if (G.phase === "shop") showShop();
}

export function sellSideCard(i) {
  const c = G.sideDeck[i];
  if (!c) return;
  const v = Math.max(1, Math.ceil((ENH[c.enh] ? ENH[c.enh].p : 3) / 2));
  G.money += v;
  G.sideDeck.splice(i, 1);
  toast(t("toast.soldCard", { amount: v }));
  render();
  if (G.phase === "shop") showShop();
  if (G.phase === "swap") renderSwapPanel();
}
