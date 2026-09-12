import type { Action } from "../game/actions";
import type { GameState, Seat } from "../game/types";

/* ============================ the wire's rules ============================
   The transport carries *actions*, not state: every peer runs the same
   reducer over the same ordered stream from the same seed, which is what the
   seat-absolute state and the per-seat economy were built for.

   Nothing here knows about WebRTC, React or the DOM. The whole of what a peer
   is allowed to do is decided in this file, so it can be read in one sitting
   and tested without a browser. */

/* Carried in `hello` and in every signalling code. Compatibility covers the
  reducer too, not just the wire shape: v2 accumulates traditional match
  points, v3 resets a lost lead but offers sooli to only one human, v4 offers
  both defenders with automatic AI decisions in Traditional Tuppi and Tuppi
  Race, v5 names room players before the host assigns chairs, and v6 changes
  no message shape at all and still has to refuse v5, because the two builds
  disagree about who resolves `leaveChallenge`: a v5 host numbers and
  broadcasts it, and a v6 peer would apply it against its own private
  `parked` run — the desync this classification fixed. The other direction is
  as bad and quieter: a v5 guest's `req` carrying it is now ignored, leaving
  that window stuck on the result screen with no answer coming. A reducer-rule
  bump with an unchanged wire shape, the same as v3's and v4's. Reject older
  engines before their rules diverge. */
export const NET_VERSION = 6;

export const PLAYER_NAME_MAX = 20;

/* What a joining device says it is. A "player" takes a chair and acts for it;
   a "table" is a shared display that holds no chair at all — it draws the
   board, sends nothing, and is refused every action by guestMay below. The
   role travels in `hello` because it is the joining device's answer, not the
   host's guess, which is why version 1 could not carry it. */
export type GuestRole = "player" | "table";

export type RoomPlayer = {
  id: string;
  name: string;
  seat: Seat | null;
};

/* What happens to an action when a session is live.

   local — never leaves the window. Nine of the ten are exactly the actions
     that touch no field hashState reads, which is asserted rather than
     assumed: the open modal, the toast, the hand's order and the sort mode are
     properties of a window, and relaying a drag would let one player reorder
     another's hand (sortMode and customOrder are single fields, not per-seat
     ones). `leaveChallenge` is the one named exception and does move the hash;
     it is local because the window that sends it stops being a peer in the
     same click — see its own comment below. The list of exceptions has length
     one, and protocol.test.ts fails if a second joins it.
   seat — relayed, and carries the seat it acts for. A guest may send one only
     for its own seat.
   flow — relayed, carries no seat. Any human may click Continue.
   auto — the clock's. The host is the only peer whose nextTick reaches the
     reducer; a guest's timer fires, this table drops it, and the numbered
     action comes back from the host instead. That is what lets useGameLoop run
     unchanged everywhere. */
export type Scope = "local" | "seat" | "flow" | "auto";

/* A Record, not a partial map: adding a member to the Action union is a
   compile error until it is classified. The race mode's actions will land here
   the day they exist, rather than being discovered on the wire. */
export const SCOPE: Record<Action["type"], Scope> = {
  /* the window's own */
  showMenu: "local",
  closeMenu: "local",
  openModal: "local",
  closeModal: "local",
  dismissToast: "local",
  clearPop: "local",
  setSortMode: "local",
  reorderHand: "local",
  moveCard: "local",
  /* The one local action that moves the hash, and the only reason it may be
     one: `leaveChallenge` restores *this* window's own parked run —
     `rehydrate(prev.parked) ?? createRun(undefined, prev.bestAnte)` — which is
     a different run on every peer, and a fresh random seed where nothing is
     parked. Broadcast, one click put every peer on a state of its own with no
     hash comparison left to notice: `hashing.due` is set by `endTrick` alone,
     and every peer then sits on `menu: "start"`, where nextTick returns null
     and no further trick ever resolves. So the two result screens that offer
     it hang the session up in the same click, and the window that goes back to
     its own roguelike stops being a peer instead of sequencing its own run's
     ticks into a race the others are still playing. */
  leaveChallenge: "local",

  /* a seat's own decisions */
  declare: "seat",
  finishSwap: "seat",
  pickSideCard: "seat",
  acceptSooli: "seat",
  declineSooli: "seat",
  sooliGive: "seat",
  startSooliPlay: "seat",
  playCard: "seat",
  layCards: "seat",
  passLaydown: "seat",
  buy: "seat",
  reroll: "seat",
  sellJoker: "seat",
  sellSideCard: "seat",
  useConsumable: "seat",

  /* the run's flow */
  newRun: "flow",
  startBlind: "flow",
  skipBlind: "flow",
  startChallenge: "flow",
  nextDeal: "flow",
  toShop: "flow",
  nextBlind: "flow",

  /* the clock's */
  aiDeclare: "auto",
  aiSooli: "auto",
  finishDeclare: "auto",
  aiPlay: "auto",
  resolveTrick: "auto",
  endTrick: "auto",
  showHandResult: "auto",
  aiLaydown: "auto",
};

export const scopeOf = (a: Action): Scope => SCOPE[a.type];

/* The host's admission test, and the only place a peer's authority is
   decided. A guest is a person you know, not a threat model — but a build one
   version out of step, or a stale timer, is a mistake worth refusing at the
   door rather than applying. */
export function guestMay(a: Action, seat: Seat | null): boolean {
  const scope = SCOPE[a.type];
  /* A peer with no chair may do nothing at all, and this clause has to come
     first: a shared table is a human at a screen and would otherwise pass the
     flow test below, click Continue and move a match it is only watching.
     One branch in one pure function is the whole of the read-only rule on the
     host's side. */
  if (seat === null) return false;
  if (scope === "flow") return true;
  if (scope !== "seat") return false;
  /* Every seat action carries `p`; the union guarantees it, and reading it
     through a narrow shape keeps this function free of the fifteen cases. */
  return (a as { p?: Seat }).p === seat;
}

/* ============================ the desync hash ============================
   A divergence caught late is unattributable, so every peer hashes the state
   at the end of each trick and the host compares.

   A hand's uids are *sorted* before hashing: reorderHand is local, so a
   guest's own drag must not read as a divergence. Everything else is compared
   in the order the game keeps it in. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function hashState(g: GameState): string {
  const hands = g.hands.map((h) =>
    h
      .map((c) => c.uid)
      .slice()
      .sort()
      .join(","),
  );
  const purses = g.economies.map((e) => `${e.money}:${e.jokers.map((j) => j.id).join("+")}`);
  return fnv1a(
    [
      g.seed,
      g.rngState,
      g.uidSeq,
      /* Who is human decides whose clock ticks — nextTick returns null for a
         "human" seat — so a peer that thinks a chair is AI runs a step no
         other peer ever sends. It is the sharpest field here. */
      g.seats.join(","),
      g.challenge ?? "-",
      g.raceDeal,
      g.raceScores.join("/"),
      g.phase,
      g.turn,
      g.leader,
      g.trickNo,
      g.tricks.join("/"),
      g.dealsLeft,
      g.ante,
      g.blindIdx,
      g.mode ?? "-",
      g.declIdx,
      g.sooliSeat ?? "-",
      g.trick.map((t) => `${t.p}${t.card.uid}`).join(","),
      hands.join("|"),
      purses.join("|"),
    ].join(";"),
  );
}

/* ============================ the messages ============================ */

export type NetMsg =
  /* a guest, at the door, saying which of the two things it is */
  | { t: "hello"; v: number; as: GuestRole; name?: string }
  /* the host, naming the guest's seat — or `null` for the shared table, which
     holds none */
  | { t: "welcome"; v: number; seat: Seat | null; id?: string }
  /* the host's authoritative pre-game roster */
  | { t: "lobby"; players: readonly RoomPlayer[] }
  /* the host, numbering an action. This is the only thing that moves a
     guest's state. */
  | { t: "act"; n: number; a: Action }
  /* a guest, asking for one */
  | { t: "req"; a: Action }
  | { t: "hash"; n: number; h: string }
  | { t: "bye" };

const isSeat = (x: unknown): x is Seat => x === 0 || x === 1 || x === 2 || x === 3;

/* Only `welcome` may carry no seat, so the null-accepting variant is its own
   rather than a widening of the test every other field uses. */
const isChair = (x: unknown): x is Seat | null => x === null || isSeat(x);

const isPeerId = (x: unknown): x is string =>
  typeof x === "string" && x.length > 0 && x.length <= 128;

const isRoomPlayer = (x: unknown): x is RoomPlayer => {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return (
    isPeerId(p.id) &&
    typeof p.name === "string" &&
    normalizePlayerName(p.name) === p.name &&
    isChair(p.seat)
  );
};

export function normalizePlayerName(name: string): string | null {
  const normalized = name.trim();
  return normalized.length > 0 && normalized.length <= PLAYER_NAME_MAX ? normalized : null;
}

/* An action off the wire is a stranger's object: it is accepted only if its
   type is one this build classifies. The reducer's own guards do the rest —
   every seat-carrying case already refuses a seat that is not "human". */
const isAction = (x: unknown): x is Action => {
  if (typeof x !== "object" || x === null) return false;
  const a = x as Record<string, unknown>;
  if (typeof a.type !== "string" || !Object.hasOwn(SCOPE, a.type)) return false;
  if (a.type === "aiSooli")
    return (
      isSeat(a.p) &&
      (a.phase === "soolioffer" || a.phase === "sooligive" || a.phase === "sooliready")
    );
  return true;
};

/* Never throws, for any string. A dropped frame, a truncated write or an old
   build is not something the app may die on, and a peer's message is the one
   input here that nothing in this project produced. */
export function parseMsg(text: string): NetMsg | null {
  const raw: unknown = safeJson(text);
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case "hello":
      /* A version 1 hello carries no `as` at all and meant a player every
         time, so it reads as one here rather than being refused — the version
         gate is the host's job and this function's job is never to throw. */
      if (typeof m.v !== "number") return null;
      if (m.as === "table")
        return m.name === undefined ? { t: "hello", v: m.v, as: "table" } : null;
      if (m.name === undefined) return { t: "hello", v: m.v, as: "player" };
      if (typeof m.name !== "string") return null;
      {
        const name = normalizePlayerName(m.name);
        return name === null ? null : { t: "hello", v: m.v, as: "player", name };
      }
    case "welcome":
      if (typeof m.v !== "number" || !isChair(m.seat)) return null;
      if (m.id === undefined) return { t: "welcome", v: m.v, seat: m.seat };
      return isPeerId(m.id) ? { t: "welcome", v: m.v, seat: m.seat, id: m.id } : null;
    case "lobby":
      return Array.isArray(m.players) && m.players.every(isRoomPlayer)
        ? { t: "lobby", players: m.players }
        : null;
    case "act":
      return typeof m.n === "number" && isAction(m.a) ? { t: "act", n: m.n, a: m.a } : null;
    case "req":
      return isAction(m.a) ? { t: "req", a: m.a } : null;
    case "hash":
      return typeof m.n === "number" && typeof m.h === "string"
        ? { t: "hash", n: m.n, h: m.h }
        : null;
    case "bye":
      return { t: "bye" };
    default:
      return null;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export const encodeMsg = (m: NetMsg): string => JSON.stringify(m);
