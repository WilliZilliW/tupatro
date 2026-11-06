import {
  PX_BURNOUT_DRAW,
  PX_DRAW,
  PX_GROUP_CARDS,
  PX_HAND_MAX,
  PX_SCANDAL_DELTA,
  PX_START_HAND,
  PX_SYMBOL_BONUS,
  PX_TABLE,
} from "./constants";
import {
  PX_ACTION_DECK,
  PX_EVENTS,
  PX_GROUP_IDS,
  PX_GROUP_NEED,
  PX_PARTIES,
  PX_PARTY_SYMBOL,
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
  PxPartyId,
  PxSpecial,
  PxTactic,
  PxVoter,
  Seat,
} from "./types";

/* ============================ Politix ============================
   Source: the Politix rule sheet, Touko Tahkokallio / Onni Games 2009
   (<https://lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf>).
   This is not tuppi and neither tuppi source knows it. The sheet gives the
   taking rule, the special cards' rules and the scoring;
   it gives no card list, deck counts, skills or most needs, and those are
   this game's own data (content.ts), constrained and tested.

   Readings where the sheet is silent or the seat model forces one:
   - Three parties of one politician each (p. 1 allows two or three parties).
     Tupatro has four seats, so three play and the owner's right-hand chair
     (owner+3) sits out. Parties, politicians and the starting seat are by lot
     (p. 2: "by lot or by agreement"). The five-player special rule (p. 6)
     needs a fifth seat and is not supported. The seat-pairing helpers play no part: the party
     of a seat is PolitixState.party.
   - Specials in a play resolve before the take, in the order listed, so a
     scandal or news in the same play counts at once.
   - A scandal (p. 5's "-1 toward hippies" example) goes only in front of a
     seat of another party, may be stacked, and lowers that seat's power
     toward its group by PX_SCANDAL_DELTA under every tactic until removed.
     No positive special exists in the 54-card deck.
   - Yesterday's news removes one burnout or scandal in front of any playing
     seat, its own included. A party symbol is not a card in any seat's
     scandals, so it can never be named (p. 5).
   - A politicking play that cannot take anything is refused; an empty play
     is refused; the most cards affordable are taken automatically.
   - Only the topmost event is active, and none before the first surfaces.
   - Each party's symbol gives a permanent PX_SYMBOL_BONUS toward its group
     (PX_PARTY_SYMBOL).
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
  "empty" | "badCards" | "noTactic" | "noGroup" | "weak" | "badBurnout" | "badScandal" | "badNews";

export type PxResult =
  | { ok: false; refusal: PxRefusal; power?: number; need?: number }
  | {
      ok: true;
      power: number;
      need: number;
      take: number;
      scandals: Four<PxCard[]>;
      burn: Four<PxCard | null>;
      /* Every uid leaving the hand, and the cards that go to the discard
         pile (politicking cards, news and whatever news removed). Scandals
         and burnout stay in front of a seat instead. */
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

/* p. 4: cards played + the politician's skill + event + scandals of that
   group in front of the seat + the party symbol's bonus. */
function powerOf(
  px: PolitixState,
  p: Seat,
  group: PxGroup,
  tactic: PxTactic,
  played: number,
  scandals: Four<PxCard[]>,
): number {
  let power = played + skillOf(px, p, tactic) + eventMod(px, tactic);
  for (const m of scandals[p]) if (m.group === group) power += PX_SCANDAL_DELTA;
  const party = px.party[p];
  if (party !== null && PX_PARTY_SYMBOL[party].group === group) power += PX_SYMBOL_BONUS;
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
  return powerOf(px, p, group, tactic, played.length, px.scandals);
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
  if (px.party[p] === null) return refuse("badCards");
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

  const scandals = px.scandals.map((m) => m.slice()) as Four<PxCard[]>;
  const burn = px.burn.slice() as Four<PxCard | null>;
  const discard: PxCard[] = [...cards];
  for (const s of play.specials) {
    const c = grab(s.uid);
    if (!c || ![0, 1, 2, 3].includes(s.target)) return refuse("badCards");
    /* A special is aimed at a playing seat of another party; the sitting-out
       seat is nobody's opponent. */
    const foe = px.party[s.target] !== null && px.party[s.target] !== px.party[p];
    if (c.kind === "scandal") {
      if (!foe) return refuse("badScandal");
      scandals[s.target].push(c);
    } else if (c.kind === "burnout") {
      /* p. 5: only onto an opposing party's seat, and never doubled. */
      if (!foe || burn[s.target] !== null) return refuse("badBurnout");
      burn[s.target] = c;
    } else if (c.kind === "news") {
      /* p. 5: one special from any seat, never a party symbol (those are not
         cards in a seat's scandals at all). */
      let removed: PxCard | null = null;
      for (let i = 0; i < 4 && !removed; i++) {
        if (px.party[i] === null) continue;
        const at = scandals[i].findIndex((m) => m.uid === s.remove);
        if (at >= 0) removed = scandals[i].splice(at, 1)[0];
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
    return { ok: true, power: 0, need: 0, take: 0, scandals, burn, used: [...used], discard };

  const group = play.group as PxGroup;
  const tactic = play.tactic as PxTactic;
  const need = PX_GROUP_NEED[group][tactic];
  const onTable = px.table.filter((v) => v.group === group).length;
  const power = powerOf(px, p, group, tactic, cards.length, scandals);
  if (power < need) return refuse("weak", power, need);
  return {
    ok: true,
    power,
    need,
    take: pxTakeCount(power, need, onTable),
    scandals,
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
   to the party with fewer turns. Positive: a is better than b. */
function pxCompare(ca: number[], ta: number, cb: number[], tb: number): number {
  const a = ca.slice().sort((x, y) => x - y);
  const b = cb.slice().sort((x, y) => x - y);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return tb - ta;
}

/* Every party tied for best (one index for a unique winner). A full tie keeps
   all tied parties, which the result screen calls a draw. */
export function pxWinner(collected: number[][], turns: number[]): number[] {
  const best: number[] = [];
  collected.forEach((c, i) => {
    if (best.length === 0) return void best.push(i);
    const d = pxCompare(c, turns[i], collected[best[0]], turns[best[0]]);
    if (d > 0) best.splice(0, best.length, i);
    else if (d === 0) best.push(i);
  });
  return best;
}

/* The next clockwise seat that plays: the sitting-out seat has no party. */
export function pxNextSeat(px: Pick<PolitixState, "party">, p: Seat): Seat {
  for (let i = 1; i <= 4; i++) {
    const s = ((p + i) % 4) as Seat;
    if (px.party[s] !== null) return s;
  }
  return p;
}

/* The three parties' winners as party ids, for the reducer and the board. */
export function pxWinnerIds(px: Pick<PolitixState, "collected" | "turns" | "party">): PxPartyId[] {
  const ids = pxPartiesInPlay(px);
  const idx = pxWinner(
    ids.map((id) => px.collected[id]),
    ids.map((id) => px.turns[id]),
  );
  return idx.map((i) => ids[i]);
}

/* The parties that have a seat, in PX_PARTIES order: the one place that says
   who is in the game, so an absent party's zeros never win a comparison. */
export function pxPartiesInPlay(px: Pick<PolitixState, "party">): PxPartyId[] {
  return PX_PARTIES.filter((id) => px.party.includes(id));
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
      });
  return deck;
}

export function pxSetup(rng: Rng, mint: Mint, owner: Seat, players = 3): PolitixState {
  /* The owner and the seats clockwise from it play; the rest sit out. Any
     count but 2 or 4 is the three-party game. */
  const count = players === 2 || players === 4 ? players : 3;
  const playing = Array.from({ length: count }, (_, i) => ((owner + i) % 4) as Seat);
  const lots = shuffle(PX_PARTIES.slice(), rng);
  const party: Four<PxPartyId | null> = [null, null, null, null];
  const politicians: Four<string | null> = [null, null, null, null];
  if (count === 4) {
    /* House rule, contradicting the sheet's p. 2 (party members sit side by
       side) on the requester's word: the four seats are shuffled and split
       two and two, so partners sit adjacent or across at random. */
    const seats = shuffle(playing.slice(), rng);
    seats.forEach((s, i) => {
      const id = lots[i < 2 ? 0 : 1];
      party[s] = id;
    });
    for (const id of lots.slice(0, 2)) {
      const rows = shuffle(
        PX_POLITICIANS.filter((x) => x.party === id),
        rng,
      );
      seats.filter((s) => party[s] === id).forEach((s, i) => (politicians[s] = rows[i].id));
    }
  } else {
    playing.forEach((s, i) => {
      party[s] = lots[i];
      politicians[s] = pick(
        rng,
        PX_POLITICIANS.filter((x) => x.party === lots[i]),
      ).id;
    });
  }
  const draw = shuffle(actionDeck(mint), rng);
  const hands: Four<PxCard[]> = [[], [], [], []];
  for (const p of playing)
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
    party,
    politicians,
    draw,
    discard: [],
    voterDeck,
    table,
    event: null,
    scandals: [[], [], [], []],
    burn: [null, null, null, null],
    collected: {
      right: PX_GROUP_IDS.map(() => 0),
      centre: PX_GROUP_IDS.map(() => 0),
      left: PX_GROUP_IDS.map(() => 0),
    },
    turns: { right: 0, centre: 0, left: 0 },
    turn: pick(rng, playing),
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
   Deterministic and drawing no randomness. In order: the take that wins the
   most voter cards (ties: the group its party holds fewest of, then fewest
   cards spent, then table order); yesterday's news on its own burnout, then
   on its own scandal whose group is on the table; rest under burnout with
   three cards or fewer; burnout on an opponent without one; a scandal on an
   opponent; otherwise pass (the turn's draw already happened). "Opponent" is a playing seat of another party,
   the one whose party currently ranks higher first, then clockwise from the
   mover. A heuristic, not optimal. */

function tableGroups(px: PolitixState): PxGroup[] {
  const out: PxGroup[] = [];
  for (const v of px.table) if (v.group !== null && !out.includes(v.group)) out.push(v.group);
  return out;
}

function bestTake(px: PolitixState, p: Seat): PxPlay | null {
  const hand = px.hands[p];
  const party = px.party[p];
  if (party === null) return null;
  const coffees = hand.filter((c) => c.kind === "coffee");
  let best: { play: PxPlay; take: number; n: number; held: number } | null = null;
  for (const group of tableGroups(px)) {
    const onTable = px.table.filter((v) => v.group === group).length;
    for (const tactic of PX_TACTICS_LIST) {
      const pool = [...hand.filter((c) => c.kind === "tactic" && c.tactic === tactic), ...coffees];
      if (!hand.some((c) => c.kind === "tactic" && c.tactic === tactic)) continue;
      const need = PX_GROUP_NEED[group][tactic];
      const takes = pool.map((_, i) =>
        pxTakeCount(powerOf(px, p, group, tactic, i + 1, px.scandals), need, onTable),
      );
      const max = Math.max(...takes);
      if (max <= 0) continue;
      const n = takes.indexOf(max) + 1;
      const held = px.collected[party][PX_GROUP_IDS.indexOf(group)];
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
    if (c.kind === "scandal") return 2;
    if (c.kind === "burnout") return 2;
    return 1;
  };
  return hand
    .map((c, i) => ({ c, i, s: score(c) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, excess)
    .map((x) => x.c.uid);
}

/* Playing seats of other parties, the party ranked higher first, then
   clockwise from the mover. */
function opponents(px: PolitixState, p: Seat): Seat[] {
  const seats: Seat[] = [];
  for (let i = 1; i < 4; i++) {
    const s = ((p + i) % 4) as Seat;
    const party = px.party[s];
    if (party !== null && party !== px.party[p]) seats.push(s);
  }
  const rank = (s: Seat): number => {
    const party = px.party[s] as PxPartyId;
    return pxPartiesInPlay(px).filter(
      (o) =>
        o !== party &&
        pxCompare(px.collected[o], px.turns[o], px.collected[party], px.turns[party]) > 0,
    ).length;
  };
  return seats
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}

export function pxMove(g: Pick<GameState, "politix" | "phase">, p: Seat): Action {
  const px = g.politix;
  if (!px) return { type: "pxPass", p };
  if (g.phase === "pxdiscard") return { type: "pxDiscard", p, uids: pxAiDiscard(px, p) };
  const hand = px.hands[p];
  const take = bestTake(px, p);
  if (take) return { type: "pxPlay", p, ...take, specials: [] };

  const groups = tableGroups(px);
  const play = (uid: string, target: Seat, remove?: string): Action => ({
    type: "pxPlay",
    p,
    group: null,
    tactic: null,
    cards: [],
    specials: [remove === undefined ? { uid, target } : { uid, target, remove }],
  });
  const news = hand.find((c) => c.kind === "news");
  if (news) {
    const own = px.burn[p];
    if (own) return play(news.uid, p, own.uid);
    const scandal = px.scandals[p].find((c) => c.group !== null && groups.includes(c.group));
    if (scandal) return play(news.uid, p, scandal.uid);
  }

  if (px.burn[p] !== null && hand.length <= 3) return { type: "pxRest", p };

  const foes = opponents(px, p);
  const burnout = hand.find((c) => c.kind === "burnout");
  if (burnout) {
    const target = foes.find((s) => px.burn[s] === null);
    if (target !== undefined) return play(burnout.uid, target);
  }
  const scandal =
    hand.find((c) => c.kind === "scandal" && c.group !== null && groups.includes(c.group)) ??
    hand.find((c) => c.kind === "scandal");
  if (scandal && foes.length > 0) return play(scandal.uid, foes[0]);
  return { type: "pxPass", p };
}
