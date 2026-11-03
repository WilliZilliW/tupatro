import {
  PX_BURNOUT_DRAW,
  PX_DRAW,
  PX_GROUP_CARDS,
  PX_HAND_MAX,
  PX_START_HAND,
  PX_TABLE,
  teamOf,
} from "./constants";
import {
  PX_ACTION_DECK,
  PX_EVENTS,
  PX_GROUP_IDS,
  PX_GROUP_NEED,
  PX_PARTY_BONUS,
  PX_POLITICIANS,
  PX_TACTICS_LIST,
} from "./content";
import { pick, shuffle, type Rng } from "./rng";
import type { Mint } from "./cards";
import type { Action } from "./actions";
import type {
  GameState,
  PolitixState,
  PxCard,
  PxGroup,
  PxSpecial,
  PxTactic,
  PxVoter,
  Seat,
} from "./types";

/* ============================ Politix ============================
   Source: the Politix rule sheet, Touko Tahkokallio / Onni Games 2009
   (<https://lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf>).
   This is not tuppi and neither tuppi source knows it. The sheet gives the
   turn structure, the taking rule, the special cards' rules and the scoring;
   it gives no card list, deck counts, skills or most needs, and those are
   this game's own data (content.ts), constrained and tested.

   Readings where the sheet is silent or the seat model forces one:
   - Four seats, two parties of two, partners ACROSS the table (teamOf). The
     sheet seats partners side by side, so turn order is A, B, A, B here.
   - Specials in a play resolve before the take, in the order listed, so a +1
     on oneself counts at once.
   - A politicking play that cannot take anything is refused; an empty play
     is refused; the most cards affordable are taken automatically.
   - Only the topmost event is active, and none before the first surfaces.
   - Each party has a permanent +1 toward one group (PX_PARTY_BONUS).
   Pure: it draws randomness only through an Rng it is handed. */

export const PX_TACTICS = PX_TACTICS_LIST;
export const PX_GROUPS = PX_GROUP_IDS;

type Four<T> = [T, T, T, T];

export type PxPlay = {
  group: PxGroup | null;
  tactic: PxTactic | null;
  cards: string[];
  specials: PxSpecial[];
};

export type PxRefusal =
  "empty" | "badCards" | "noTactic" | "noGroup" | "weak" | "badBurnout" | "badNews";

export type PxResult =
  | { ok: false; refusal: PxRefusal; power?: number; need?: number }
  | {
      ok: true;
      power: number;
      need: number;
      take: number;
      mods: Four<PxCard[]>;
      burn: Four<PxCard | null>;
      /* Every uid leaving the hand, and the cards that go to the discard
         pile (politicking cards, news and whatever news removed). Group
         modifiers and burnout stay in front of a seat instead. */
      used: string[];
      discard: PxCard[];
    };

/* ============================ the rule ============================ */

/* p. 4: power at least the need takes one card, and each extra card of the
   same group costs one more power. */
export function pxTakeCount(power: number, need: number, onTable: number): number {
  return power < need ? 0 : Math.min(onTable, 1 + power - need);
}

function skillOf(px: PolitixState, p: Seat, tactic: PxTactic): number {
  const row = PX_POLITICIANS.find((x) => x.id === px.politicians[p]);
  return row ? row.skills[PX_TACTICS_LIST.indexOf(tactic)] : 0;
}

function eventMod(px: PolitixState, tactic: PxTactic): number {
  const ev = PX_EVENTS.find((e) => e.id === px.event);
  return ev && ev.tactic === tactic ? ev.delta : 0;
}

/* p. 4: cards played + the politician's skill + event + group modifiers in
   front of the seat + the party symbol's bonus. */
function powerOf(
  px: PolitixState,
  p: Seat,
  group: PxGroup,
  tactic: PxTactic,
  played: number,
  mods: Four<PxCard[]>,
): number {
  let power = played + skillOf(px, p, tactic) + eventMod(px, tactic);
  for (const m of mods[p]) if (m.group === group) power += m.delta;
  if (PX_PARTY_BONUS[teamOf(p)] === group) power += 1;
  return power;
}

export function pxPower(
  g: Pick<GameState, "politix">,
  p: Seat,
  group: PxGroup,
  tactic: PxTactic,
  cardUids: string[],
): number {
  const px = g.politix;
  if (!px) return 0;
  const played = px.hands[p].filter(
    (c) =>
      cardUids.includes(c.uid) &&
      (c.kind === "coffee" || (c.kind === "tactic" && c.tactic === tactic)),
  );
  return powerOf(px, p, group, tactic, played.length, px.mods);
}

const refuse = (refusal: PxRefusal, power?: number, need?: number): PxResult => ({
  ok: false,
  refusal,
  power,
  need,
});

/* The whole legality check, as a pure function over copies: the reducer runs
   it and applies the result, the felt runs it to show power against need. */
export function pxResolve(g: Pick<GameState, "politix">, p: Seat, play: PxPlay): PxResult {
  const px = g.politix;
  if (!px) return refuse("empty");
  if (play.cards.length === 0 && play.specials.length === 0) return refuse("empty");
  const hand = px.hands[p];
  const used = new Set<string>();
  const grab = (uid: string): PxCard | null => {
    if (used.has(uid)) return null;
    const c = hand.find((x) => x.uid === uid);
    if (!c) return null;
    used.add(uid);
    return c;
  };

  const cards: PxCard[] = [];
  for (const uid of play.cards) {
    const c = grab(uid);
    if (!c) return refuse("badCards");
    if (c.kind !== "coffee" && !(c.kind === "tactic" && c.tactic === play.tactic))
      return refuse("badCards");
    cards.push(c);
  }
  if (cards.length > 0) {
    if (!cards.some((c) => c.kind === "tactic")) return refuse("noTactic");
    if (play.group === null || play.tactic === null) return refuse("noGroup");
    if (!px.table.some((v) => v.group === play.group)) return refuse("noGroup");
  }

  const mods = px.mods.map((m) => m.slice()) as Four<PxCard[]>;
  const burn = px.burn.slice() as Four<PxCard | null>;
  const discard: PxCard[] = [...cards];
  for (const s of play.specials) {
    const c = grab(s.uid);
    if (!c || ![0, 1, 2, 3].includes(s.target)) return refuse("badCards");
    if (c.kind === "mod") mods[s.target].push(c);
    else if (c.kind === "burnout") {
      /* p. 5: only onto an opposing party's seat, and never doubled. */
      if (teamOf(s.target) === teamOf(p) || burn[s.target] !== null) return refuse("badBurnout");
      burn[s.target] = c;
    } else if (c.kind === "news") {
      /* p. 5: one special from any seat, never a party symbol (those are not
         cards in a seat's mods at all). */
      let removed: PxCard | null = null;
      for (let i = 0; i < 4 && !removed; i++) {
        const at = mods[i].findIndex((m) => m.uid === s.remove);
        if (at >= 0) removed = mods[i].splice(at, 1)[0];
        else if (burn[i] !== null && burn[i]?.uid === s.remove) {
          removed = burn[i];
          burn[i] = null;
        }
      }
      if (!removed) return refuse("badNews");
      discard.push(c, removed);
    } else return refuse("badCards");
  }

  if (cards.length === 0)
    return { ok: true, power: 0, need: 0, take: 0, mods, burn, used: [...used], discard };

  const group = play.group as PxGroup;
  const tactic = play.tactic as PxTactic;
  const need = PX_GROUP_NEED[group][tactic];
  const onTable = px.table.filter((v) => v.group === group).length;
  const power = powerOf(px, p, group, tactic, cards.length, mods);
  if (power < need) return refuse("weak", power, need);
  return {
    ok: true,
    power,
    need,
    take: pxTakeCount(power, need, onTable),
    mods,
    burn,
    used: [...used],
    discard,
  };
}

export function pxLegalPlay(
  g: Pick<GameState, "politix">,
  p: Seat,
  play: PxPlay,
): PxRefusal | null {
  const r = pxResolve(g, p, play);
  return r.ok ? null : r.refusal;
}

/* p. 6: each party's per-group counts (zeros included) sorted ascending are
   compared lexicographically and the larger vector wins; equal vectors fall
   to the party with fewer turns; equal turns too is a draw. */
export function pxWinner(collected: [number[], number[]], turns: [number, number]): 0 | 1 | "draw" {
  const a = collected[0].slice().sort((x, y) => x - y);
  const b = collected[1].slice().sort((x, y) => x - y);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0 ? 0 : 1;
  }
  if (turns[0] !== turns[1]) return turns[0] < turns[1] ? 0 : 1;
  return "draw";
}

/* ============================ setup and piles ============================ */

function actionDeck(mint: Mint): PxCard[] {
  const deck: PxCard[] = [];
  for (const row of PX_ACTION_DECK)
    for (let i = 0; i < row.n; i++)
      deck.push({
        uid: mint.next(),
        kind: row.kind,
        tactic: row.tactic,
        group: row.group,
        delta: row.delta,
      });
  return deck;
}

export function pxSetup(rng: Rng, mint: Mint): PolitixState {
  const pols = shuffle(
    PX_POLITICIANS.map((x) => x.id),
    rng,
  ).slice(0, 4) as Four<string>;
  const draw = shuffle(actionDeck(mint), rng);
  const hands: Four<PxCard[]> = [[], [], [], []];
  for (let p = 0; p < 4; p++)
    for (let i = 0; i < PX_START_HAND; i++) hands[p].push(draw.pop() as PxCard);

  /* An event that surfaces while the table is laid is shuffled back (p. 1).
     Laying eight group cards from a group-only deck and shuffling the events
     into the rest afterwards is the same distribution without a retry loop. */
  const groups: PxVoter[] = [];
  for (const group of PX_GROUP_IDS)
    for (let i = 0; i < PX_GROUP_CARDS; i++) groups.push({ uid: mint.next(), group, event: null });
  const rest = shuffle(groups, rng);
  const table = rest.splice(0, PX_TABLE);
  const events: PxVoter[] = PX_EVENTS.map((e) => ({ uid: mint.next(), group: null, event: e.id }));
  const voterDeck = shuffle([...rest, ...events], rng);

  return {
    hands,
    politicians: pols,
    draw,
    discard: [],
    voterDeck,
    table,
    event: null,
    mods: [[], [], [], []],
    burn: [null, null, null, null],
    collected: [PX_GROUP_IDS.map(() => 0), PX_GROUP_IDS.map(() => 0)],
    turns: [0, 0],
    turn: pick(rng, [0, 1, 2, 3] as Seat[]),
    turnNo: 0,
    last: null,
  };
}

/* p. 6: an empty draw pile is rebuilt by shuffling the discard pile. When both
   are empty a draw takes what there is. */
export function pxDrawCards(px: PolitixState, p: Seat, n: number, rng: Rng): void {
  for (let i = 0; i < n; i++) {
    if (px.draw.length === 0) {
      if (px.discard.length === 0) return;
      px.draw = shuffle(px.discard.slice(), rng);
      px.discard = [];
    }
    px.hands[p].push(px.draw.pop() as PxCard);
  }
}

export function pxDrawCount(px: PolitixState, p: Seat): number {
  return px.burn[p] !== null ? PX_BURNOUT_DRAW : PX_DRAW;
}

/* p. 4: refill to eight; an event goes on top of the previous one and never
   counts toward the eight. */
export function pxRefill(px: PolitixState): void {
  while (px.table.length < PX_TABLE && px.voterDeck.length > 0) {
    const v = px.voterDeck.pop() as PxVoter;
    if (v.event !== null) px.event = v.event;
    else px.table.push(v);
  }
}

/* ============================ the AI ============================
   Deterministic and drawing no randomness. Take the play that wins the most
   voter cards (ties: the group its party holds fewest of, then fewest cards
   spent, then table order); otherwise burnout on an opponent, a +1 on itself,
   a -1 on an opponent; rest under burnout with three cards or fewer;
   otherwise draw. A heuristic, not optimal. */

function tableGroups(px: PolitixState): PxGroup[] {
  const out: PxGroup[] = [];
  for (const v of px.table) if (v.group !== null && !out.includes(v.group)) out.push(v.group);
  return out;
}

function bestTake(px: PolitixState, p: Seat): PxPlay | null {
  const hand = px.hands[p];
  const team = teamOf(p);
  const coffees = hand.filter((c) => c.kind === "coffee");
  let best: { play: PxPlay; take: number; n: number; held: number } | null = null;
  for (const group of tableGroups(px)) {
    const onTable = px.table.filter((v) => v.group === group).length;
    for (const tactic of PX_TACTICS_LIST) {
      const pool = [...hand.filter((c) => c.kind === "tactic" && c.tactic === tactic), ...coffees];
      if (!hand.some((c) => c.kind === "tactic" && c.tactic === tactic)) continue;
      const need = PX_GROUP_NEED[group][tactic];
      const takes = pool.map((_, i) =>
        pxTakeCount(powerOf(px, p, group, tactic, i + 1, px.mods), need, onTable),
      );
      const max = Math.max(...takes);
      if (max <= 0) continue;
      const n = takes.indexOf(max) + 1;
      const held = px.collected[team][PX_GROUP_IDS.indexOf(group)];
      const better =
        best === null ||
        max > best.take ||
        (max === best.take && (held < best.held || (held === best.held && n < best.n)));
      if (better)
        best = {
          play: { group, tactic, cards: pool.slice(0, n).map((c) => c.uid), specials: [] },
          take: max,
          n,
          held,
        };
    }
  }
  return best ? best.play : null;
}

/* Which cards to throw away to reach the hand limit: the ones that
   contribute least to a reachable take. */
export function pxAiDiscard(px: PolitixState, p: Seat): string[] {
  const hand = px.hands[p];
  const excess = hand.length - PX_HAND_MAX;
  if (excess <= 0) return [];
  const score = (c: PxCard): number => {
    if (c.kind === "coffee") return 6;
    if (c.kind === "tactic" && c.tactic !== null) {
      const same = hand.filter((x) => x.kind === "tactic" && x.tactic === c.tactic).length;
      return 3 + Math.min(same, 4) + skillOf(px, p, c.tactic);
    }
    if (c.kind === "mod") return 2;
    if (c.kind === "burnout") return 2;
    return 1;
  };
  return hand
    .map((c, i) => ({ c, i, s: score(c) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, excess)
    .map((x) => x.c.uid);
}

export function pxMove(g: Pick<GameState, "politix" | "phase">, p: Seat): Action {
  const px = g.politix;
  if (!px) return { type: "pxDraw", p };
  if (g.phase === "pxdiscard") return { type: "pxDiscard", p, uids: pxAiDiscard(px, p) };
  const hand = px.hands[p];
  const take = bestTake(px, p);
  if (take) return { type: "pxPlay", p, ...take, specials: [] };

  if (px.burn[p] !== null && hand.length <= 3) return { type: "pxRest", p };

  const groups = tableGroups(px);
  const foe = ((p + 1) % 4) as Seat;
  const team = teamOf(p);
  const play = (uid: string, target: Seat): Action => ({
    type: "pxPlay",
    p,
    group: null,
    tactic: null,
    cards: [],
    specials: [{ uid, target }],
  });
  const burnout = hand.find((c) => c.kind === "burnout");
  if (burnout) {
    const target = [foe, ((p + 3) % 4) as Seat].find((s) => px.burn[s] === null);
    if (target !== undefined) return play(burnout.uid, target);
  }
  const plus = hand
    .filter((c) => c.kind === "mod" && c.delta > 0 && c.group !== null && groups.includes(c.group))
    .sort(
      (a, b) =>
        px.collected[team][PX_GROUP_IDS.indexOf(a.group as PxGroup)] -
        px.collected[team][PX_GROUP_IDS.indexOf(b.group as PxGroup)],
    )[0];
  if (plus) return play(plus.uid, p);
  const minus = hand.find(
    (c) => c.kind === "mod" && c.delta < 0 && c.group !== null && groups.includes(c.group),
  );
  if (minus) return play(minus.uid, foe);
  return { type: "pxDraw", p };
}
