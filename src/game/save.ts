import { BOSSES, CONSUMABLES, ENH, JOKERS, VOUCHERS } from "./content";
import { cardOffer } from "./shop";
import { createRun } from "./state";
import type { Card, Enhancement, GameState, ShopItem, Suit } from "./types";

/* ============================ saving a run ============================
   A snapshot of the state, not an action log. Most of GameState is already
   JSON-safe; what is not are the content objects, which carry function
   references (a joker's `add`, `xm`, `retrig`, `won`). Those are stored as
   content ids and looked back up in the tables at load time, so a resumed
   joker is the *same object* as the one in JOKERS and still scores.

   Loading starts from createRun(seed) and overwrites the saved keys, so a
   field added to GameState later arrives at its createRun value rather than
   as undefined.

   This module is pure: storage.ts owns the browser store, and GameProvider
   owns when a save is written. */

/* Bumped when the state shape changes. An old save is then rejected and
   overwritten in place — saves are not migrated.

   Twice now it has deliberately *not* been bumped, because rehydrate starts
   from createRun(seed): a field the save lacks arrives at its createRun value,
   and a run in flight is worth more than a clean shape. The four-blind ante is
   the wider of the two — a save written under three blinds carries a
   three-element `beaten` while the type says four, so `beaten[3]` reads
   undefined, which is falsy and draws as "not beaten". Both known gaps are
   written up in CLAUDE.md. The bump is required the moment a widened field is
   read positionally rather than for truthiness, since the cast in rehydrate
   hides the divergence from the compiler. */
export const SAVE_VERSION = 1;

/* Transient view state a resumed run deliberately opens without, plus
   partyMap, which createRun recomputes from the seed. */
type Dropped = "modal" | "toast" | "toastSeq" | "pop" | "partyMap";

/* The fields that carry function references. */
type ById = "jokers" | "consumables" | "boss" | "shop";

export type SavedShopItem =
  | { kind: "joker" | "consumable" | "voucher"; id: string; price: number; sold: boolean }
  | { kind: "card"; s: Suit; r: number; enh: Enhancement; price: number; sold: boolean };

export type SavedRun = Omit<GameState, Dropped | ById> & {
  v: number;
  jokers: string[];
  consumables: string[];
  boss: string | null;
  shop: SavedShopItem[] | null;
};

function dehydrateItem(it: ShopItem): SavedShopItem {
  const { price, sold } = it;
  /* A card offer is in no content table: rollCardOffer mints it. Only the
     card itself is stored, and cardOffer rebuilds the rest from ENH. */
  if (it.kind === "card") {
    const { s, r, enh } = it.data.card;
    return { kind: "card", s, r, enh, price, sold };
  }
  return { kind: it.kind, id: it.data.id, price, sold };
}

const DROPPED_KEYS: Dropped[] = ["modal", "toast", "toastSeq", "pop", "partyMap"];

export function dehydrate(g: GameState): SavedRun {
  /* Rest-spread rather than a list of fields: a field added to GameState
     later rides along instead of quietly missing from every save. The dropped
     ones are removed by name afterwards, which is the same list twice — the
     type and the runtime — but keeps that property. */
  const { jokers, consumables, boss, shop, ...rest } = g;
  const kept: Partial<GameState> = { ...rest };
  for (const k of DROPPED_KEYS) delete kept[k];
  return {
    ...(kept as Omit<GameState, Dropped | ById>),
    v: SAVE_VERSION,
    jokers: jokers.map((j) => j.id),
    consumables: consumables.map((c) => c.id),
    boss: boss ? boss.id : null,
    shop: shop ? shop.map(dehydrateItem) : null,
  };
}

/* ============================ loading ============================ */

function byId<T extends { id: string }>(table: T[], id: unknown): T | null {
  if (typeof id !== "string") return null;
  return table.find((x) => x.id === id) ?? null;
}

/* Null on the first id the table does not know: a save is rejected whole
   rather than loaded half, which would leave an effect-less joker scoring
   nothing. */
function mapIds<T extends { id: string }>(table: T[], ids: unknown): T[] | null {
  if (!Array.isArray(ids)) return null;
  const out: T[] = [];
  for (const id of ids) {
    const found = byId(table, id);
    if (!found) return null;
    out.push(found);
  }
  return out;
}

const knownEnh = (e: unknown): e is Enhancement => typeof e === "string" && e in ENH;

const cardOk = (c: unknown): boolean => {
  if (!c || typeof c !== "object") return false;
  const enh = (c as Card).enh;
  return enh === null || enh === undefined || knownEnh(enh);
};

const cardsOk = (cards: unknown): boolean => Array.isArray(cards) && cards.every(cardOk);

function rehydrateShop(raw: unknown): ShopItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ShopItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") return null;
    const item = it as SavedShopItem;
    const { price, sold } = item;
    if (item.kind === "card") {
      if (!knownEnh(item.enh)) return null;
      out.push({ kind: "card", data: cardOffer(item.s, item.r, item.enh), price, sold });
      continue;
    }
    if (item.kind === "joker") {
      const data = byId(JOKERS, item.id);
      if (!data) return null;
      out.push({ kind: "joker", data, price, sold });
      continue;
    }
    if (item.kind === "consumable") {
      const data = byId(CONSUMABLES, item.id);
      if (!data) return null;
      out.push({ kind: "consumable", data, price, sold });
      continue;
    }
    if (item.kind === "voucher") {
      const data = byId(VOUCHERS, item.id);
      if (!data) return null;
      out.push({ kind: "voucher", data, price, sold });
      continue;
    }
    return null;
  }
  return out;
}

/* Validation is the version and the content ids, and nothing deeper: a
   hand-edited save with an eleven-card hand loads and plays incoherently.
   SAVE_VERSION is the tool for a state-shape change. */
export function rehydrate(raw: unknown, bestAnte: number): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const { v, jokers, consumables, boss, shop, ...rest } = raw as Partial<SavedRun>;
  if (v !== SAVE_VERSION) return null;
  if (typeof rest.seed !== "string") return null;

  const owned = mapIds(JOKERS, jokers);
  const cons = mapIds(CONSUMABLES, consumables);
  if (!owned || !cons) return null;
  /* Vouchers are already ids in the state, so only their existence is read. */
  if (!Array.isArray(rest.vouchers) || !rest.vouchers.every((id) => byId(VOUCHERS, id)))
    return null;

  const bossData = boss === null || boss === undefined ? null : byId(BOSSES, boss);
  if (boss && !bossData) return null;

  const stock = shop === null || shop === undefined ? null : rehydrateShop(shop);
  if (shop && !stock) return null;

  if (!Array.isArray(rest.hands) || rest.hands.length !== 4) return null;
  if (!rest.hands.every(cardsOk) || !cardsOk(rest.sideDeck)) return null;

  /* The two keys can disagree when another tab advanced the record. */
  const best = Math.max(bestAnte, typeof rest.bestAnte === "number" ? rest.bestAnte : 0);
  return {
    ...createRun(rest.seed, best),
    ...rest,
    jokers: owned,
    consumables: cons,
    boss: bossData,
    shop: stock,
    bestAnte: best,
  };
}
