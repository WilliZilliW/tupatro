import { BOSSES, CHALLENGES, CONSUMABLES, ENH, JOKERS, VOUCHERS } from "./content";
import { SUITS } from "./constants";
import { soloBoard } from "./rules";
import { cardOffer } from "./shop";
import { createRun, newEconomy } from "./state";
import type {
  Card,
  ChallengeId,
  Enhancement,
  GameState,
  PlayerEconomy,
  ShopItem,
  Suit,
} from "./types";

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
   overwritten in place. Saves are not migrated, and there is no exception to
   that today: this module holds no upgrade function. Twice it did — once per
   bump below — each buying the runs already in flight a few days of grace,
   and each deleted on the schedule it set itself, so only ever one existed at
   a time and no v1 -> v2 -> v3 chain formed. CLAUDE.md's known gaps keep the
   record by name.

   Five times now it has deliberately *not* been bumped, because rehydrate
   starts from createRun(seed): a field the save lacks arrives at its createRun
   value, and a run in flight is worth more than a clean shape. CLAUDE.md's
   known gaps number all five by name; the first, the scoreboard's own arrival,
   is not repeated here since it touches no field this module reads back. The
   four-blind ante is the second and the widest — a save written under three
   blinds carries a three-element `beaten` while the type says four, so
   `beaten[3]` reads undefined, which is falsy and draws as "not beaten". The
   challenge was the third and the mildest, when it was first added: every
   field it adds is right for an older save at its createRun value (challenge
   null, an empty table and layHands, parked null), and none of them was read
   positionally — a challenge run was never written to disk at all, then. The
   race's three fields (raceDeal, raceBase, raceScores) are the fourth, added
   rather than moved or removed, so a v3 payload written before the mode
   arrives at createRun's own zeroes.

   The fifth is that same challenge shape from the third non-bump, now that a
   challenge writes a snapshot of its own. Nothing about `SavedRun` moved or
   was removed to make that so: `challenge`, `table`, `layHands`, `layTurn`,
   `layNo`, `layPassed` and `layScores` already rode along in `dehydrate`'s
   rest-spread before this change, simply unread by `rehydrate` until now.
   What changed is that three of them — `table`, `layHands` and `challenge` —
   are read positionally for the first time (a laydown row's cards, a pair of
   hands, a content id), which is exactly the condition that forced the bump
   on the ante and the seat-absolute change. It is a non-bump here regardless,
   because `cardOk` and the three new `rehydrate` checks close that gap
   directly: a malformed `table` row, an uneven `layHands` or an unknown
   `challenge` id is refused whole, the same as an unknown joker id always
   was, so there is no divergence for a positional read to silently hide. The
   bump is required the moment a widened field is read positionally *and*
   left unvalidated, since the cast in rehydrate hides the divergence from
   the compiler and nothing else would catch it.

   Version 2 was the first true shape change, and the first bump. Making the
   state seat-absolute *removed* two fields — usTricks and themTricks became
   tricks[team] — so an older payload is not "a field missing at its createRun
   value" the way the non-bumps above are: it carries a trick count
   under a name nothing reads any more, and a run resumed from it would report
   0–0 for a deal it had half played.

   Version 3 is the second, for the same kind of reason: the seventeen economy
   fields *moved* out of the top level into economies[seat], so a v2 payload
   carries a purse and an inventory under names nothing reads any more, and a
   run resumed from it would start over at createRun's six dollars with no
   joker it had bought. Both v1 and v2 are dropped outright now: the upgrade
   that carried each across is gone, every run still saved under either is
   gone with it — the loss those upgrades only deferred — and the reading that
   survives is that at most one migration exists at a time, which today means
   none. */
export const SAVE_VERSION = 3;

/* Transient view state a resumed run deliberately opens without, plus
   partyMap, which createRun recomputes from the seed. `menu` is among them:
   a reload opens on the start menu because the boot path puts it there, not
   because a snapshot remembered it.

   `parked` is dropped for a different reason: it is a snapshot itself, and a
   snapshot that nested would grow without bound. It is only ever set while a
   challenge is being played (or parked behind a second one), so dropping it
   here costs a challenge's own slot nothing — `leaveChallenge` and
   `resumeGame` both read the *live* `parked`, never a disk copy of it. */
type Dropped = "modal" | "menu" | "toast" | "toastSeq" | "pop" | "partyMap" | "parked";

/* The fields that carry function references. All but the boss now sit inside
   a wallet, so the top level stores only the boss by id. */
type ById = "boss" | "economies";
type EconById = "jokers" | "consumables" | "shop";

export type SavedShopItem =
  | { kind: "joker" | "consumable" | "voucher"; id: string; price: number; sold: boolean }
  | { kind: "card"; s: Suit; r: number; enh: Enhancement; price: number; sold: boolean };

/* One seat's wallet, with its three function-carrying fields by id. */
export type SavedEconomy = Omit<PlayerEconomy, EconById> & {
  jokers: string[];
  consumables: string[];
  shop: SavedShopItem[] | null;
};

export type SavedRun = Omit<GameState, Dropped | ById> & {
  v: number;
  boss: string | null;
  economies: [SavedEconomy, SavedEconomy, SavedEconomy, SavedEconomy];
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

const DROPPED_KEYS: Dropped[] = ["modal", "menu", "toast", "toastSeq", "pop", "partyMap", "parked"];

function dehydrateEcon(e: PlayerEconomy): SavedEconomy {
  const { jokers, consumables, shop, ...rest } = e;
  return {
    ...rest,
    jokers: jokers.map((j) => j.id),
    consumables: consumables.map((c) => c.id),
    shop: shop ? shop.map(dehydrateItem) : null,
  };
}

export function dehydrate(g: GameState): SavedRun {
  /* Rest-spread rather than a list of fields: a field added to GameState
     later rides along instead of quietly missing from every save. The dropped
     ones are removed by name afterwards, which is the same list twice — the
     type and the runtime — but keeps that property. */
  const { boss, economies, ...rest } = g;
  const kept: Partial<GameState> = { ...rest };
  for (const k of DROPPED_KEYS) delete kept[k];
  return {
    ...(kept as Omit<GameState, Dropped | ById>),
    v: SAVE_VERSION,
    boss: boss ? boss.id : null,
    /* Every seat's wallet, not the owner's alone: a wallet silently dropped
       here would be a run that lost an inventory on the first reload. */
    economies: economies.map(dehydrateEcon) as SavedRun["economies"],
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

/* Strengthened from "the enhancement is known" now that a snapshot's
   `table` and `layHands` are read back for the first time: those two arrays
   were never round-tripped before a challenge could be saved, so a
   hand-edited or truncated card in either would previously have loaded
   silently rather than being refused with the rest of the save. */
const cardOk = (c: unknown): boolean => {
  if (!c || typeof c !== "object") return false;
  const card = c as Partial<Card>;
  if (typeof card.s !== "string" || !(SUITS as readonly string[]).includes(card.s)) return false;
  if (typeof card.r !== "number") return false;
  if (typeof card.id !== "string") return false;
  if (typeof card.uid !== "string") return false;
  const enh = card.enh;
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
/* ==================== one wallet ====================
   Rejected whole on the first id no table knows, exactly as the top level
   was: half a wallet is a joker with no effect, scoring nothing. */
function rehydrateEcon(raw: unknown): PlayerEconomy | null {
  if (!raw || typeof raw !== "object") return null;
  const { jokers, consumables, shop, ...rest } = raw as Partial<SavedEconomy>;
  const owned = mapIds(JOKERS, jokers);
  const cons = mapIds(CONSUMABLES, consumables);
  if (!owned || !cons) return null;
  /* Vouchers are already ids in the state, so only their existence is read. */
  if (!Array.isArray(rest.vouchers) || !rest.vouchers.every((id) => byId(VOUCHERS, id)))
    return null;
  if (!cardsOk(rest.sideDeck)) return null;

  const stock = shop === null || shop === undefined ? null : rehydrateShop(shop);
  if (shop && !stock) return null;

  return {
    ...newEconomy(),
    ...(rest as Omit<SavedEconomy, EconById>),
    jokers: owned,
    consumables: cons,
    shop: stock,
  };
}

export function rehydrate(raw: unknown, bestAnte: number): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const { v, boss, economies, ...rest } = raw as Partial<SavedRun>;
  if (v !== SAVE_VERSION) return null;
  if (typeof rest.seed !== "string") return null;

  /* Four wallets or none: a shorter array would leave a seat's economy
     undefined, and econOf reads it positionally. */
  if (!Array.isArray(economies) || economies.length !== 4) return null;
  const wallets: PlayerEconomy[] = [];
  for (const w of economies) {
    const e = rehydrateEcon(w);
    if (!e) return null;
    wallets.push(e);
  }

  const bossData = boss === null || boss === undefined ? null : byId(BOSSES, boss);
  if (boss && !bossData) return null;

  if (!Array.isArray(rest.hands) || rest.hands.length !== 4) return null;
  if (!rest.hands.every(cardsOk)) return null;

  /* The laydown's own two arrays, read back for the first time now that a
     challenge in progress reaches disk. Rejected whole, the same rule the
     hands already have: a hand-edited table row would otherwise load
     incoherently rather than being refused with the rest of the save. */
  if (!Array.isArray(rest.table) || !rest.table.every(cardsOk)) return null;
  if (!Array.isArray(rest.layHands) || rest.layHands.length !== 2 || !rest.layHands.every(cardsOk))
    return null;
  /* null (the main run) or one of the three known ids — anything else is a
     save this build has no rule set for. */
  if (rest.challenge !== null && !CHALLENGES.some((c) => c.id === rest.challenge)) return null;

  /* The two keys can disagree when another tab advanced the record. */
  const best = Math.max(bestAnte, typeof rest.bestAnte === "number" ? rest.bestAnte : 0);
  return {
    ...createRun(rest.seed, best),
    ...rest,
    economies: wallets as GameState["economies"],
    boss: bossData,
    bestAnte: best,
    /* Every save written before the menu shipped is a real run, so the field
       it lacks defaults to true rather than to createRun's false — otherwise
       resuming one would offer no way back into it. */
    runStarted: rest.runStarted ?? true,
  };
}

/* ============================ resuming a slot ============================
   rehydrate plus the two refusals a Continue button needs before it trusts
   what a slot holds: the payload has to be *for the slot it was read from* —
   `id` is null for the main run's own key and a ChallengeId for one of the
   three challenge slots — and the board it names has to be soloBoard. A race
   slot holding a rummikub payload, and a save naming two humans, both read as
   no save at all rather than a save this button would resume into the wrong
   game or hand back to a seat with no wallet of its own.

   `initialState`'s boot read uses this for the main run too: the write side
   there carries no soloBoard guard of its own (a hosted roguelike that hangs
   up on a screen can still write a two-human snapshot), so this is where that
   hole is closed instead, on the read that would otherwise resume into it. */
export function resumable(
  raw: unknown,
  id: ChallengeId | null,
  bestAnte: number,
): GameState | null {
  const g = rehydrate(raw, bestAnte);
  if (!g) return null;
  if (g.challenge !== id) return null;
  if (!soloBoard(g)) return null;
  return g;
}
