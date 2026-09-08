import { NET_VERSION, encodeMsg, guestMay, parseMsg, scopeOf } from "./protocol";
import type { Action } from "../game/actions";
import type { Seat } from "../game/types";

/* ============================ the relay ============================
   The host is the sequencer and the clock. It numbers every shared action,
   applies it once and broadcasts it; a guest's click is a *request*, and what
   moves a guest's state is the numbered action that comes back. One sequencer
   makes the ordering trivially identical on every peer, at the cost of one
   round trip on a guest's own click. That latency is the price of a relay
   that needs no rollback.

   There is no WebRTC in this file. A session is built with a `send`, an
   `apply` and a status callback, so the test wires two sessions to each
   other's `receive` and plays a whole blind with no browser. */

export type SessionStatus =
  /* connected and in step */
  | "live"
  /* the numbered stream has a gap, or a peer's hash disagrees. Applying past
     this point would hide where it happened. */
  | "desync"
  /* a peer on another NET_VERSION: refused at the door rather than allowed to
     diverge an hour later */
  | "version"
  /* a peer that arrived after the first action was numbered. There is no
     reconnect yet: the numbered stream starts at one and a peer that missed
     part of it cannot be caught up, so it is turned away at the door instead
     of joining a game it would immediately desync from. */
  | "late"
  | "dropped";

export type SessionDeps = {
  send: (peer: string, text: string) => void;
  apply: (a: Action) => void;
  onStatus: (s: SessionStatus, info?: string) => void;
};

/* React's dispatch does not update state synchronously, so a session can
   never hash "right after applying". The window hands the hash in on a later
   render instead, and the session knows which action number that render
   reflects. */
type Hashing = { lastN: number; due: boolean };

/* ==================== the host ==================== */

export type HostSession = {
  /* the host's own click, or its clock */
  intent: (a: Action) => void;
  receive: (peer: string, text: string) => void;
  /* a data channel opened; the chair the lobby set aside for it */
  join: (peer: string, seat: Seat) => void;
  leave: (peer: string) => void;
  localHash: (h: string) => void;
  seatOf: (peer: string) => Seat | undefined;
  /* the number of the last action the host sequenced, for tests and the
     banner */
  count: () => number;
};

export function hostSession(deps: SessionDeps): HostSession {
  const seats = new Map<string, Seat>();
  /* Hashes for one action number, from every peer including this one, kept
     until both sides of a comparison exist: a guest renders on its own clock,
     so its hash can arrive before or after the host's. */
  const mine = new Map<number, string>();
  const theirs = new Map<number, Map<string, string>>();
  const seq = { n: 0 };
  const hashing: Hashing = { lastN: 0, due: false };

  const broadcast = (text: string) => {
    for (const peer of seats.keys()) deps.send(peer, text);
  };

  /* One place where an action becomes part of the stream: applied here, once,
     and sent to everyone with the number it was applied under. */
  const sequence = (a: Action) => {
    seq.n++;
    hashing.lastN = seq.n;
    if (a.type === "endTrick") hashing.due = true;
    deps.apply(a);
    broadcast(encodeMsg({ t: "act", n: seq.n, a }));
  };

  const compare = (n: number) => {
    const h = mine.get(n);
    const from = theirs.get(n);
    if (h === undefined || !from) return;
    for (const [peer, their] of from) if (their !== h) deps.onStatus("desync", `${peer}@${n}`);
    /* Compared once; keeping them would grow without bound over a run. */
    if (from.size >= seats.size) {
      theirs.delete(n);
      mine.delete(n);
    }
  };

  return {
    intent(a) {
      if (scopeOf(a) === "local") {
        deps.apply(a);
        return;
      }
      sequence(a);
    },

    receive(peer, text) {
      const m = parseMsg(text);
      if (!m) return;
      const seat = seats.get(peer);
      switch (m.t) {
        case "hello":
          if (m.v !== NET_VERSION) {
            deps.send(peer, encodeMsg({ t: "bye" }));
            deps.onStatus("version", peer);
            return;
          }
          if (seat === undefined) return;
          if (seq.n > 0) {
            deps.send(peer, encodeMsg({ t: "bye" }));
            seats.delete(peer);
            deps.onStatus("late", peer);
            return;
          }
          deps.send(peer, encodeMsg({ t: "welcome", v: NET_VERSION, seat }));
          deps.onStatus("live", peer);
          return;
        case "req":
          /* The admission test is the whole of a peer's authority: its own
             seat's decisions, and the run's flow. */
          if (seat === undefined || !guestMay(m.a, seat)) return;
          sequence(m.a);
          return;
        case "hash": {
          const at = theirs.get(m.n) ?? new Map<string, string>();
          at.set(peer, m.h);
          theirs.set(m.n, at);
          compare(m.n);
          return;
        }
        case "bye":
          seats.delete(peer);
          deps.onStatus("dropped", peer);
          return;
        default:
          return;
      }
    },

    join(peer, seat) {
      seats.set(peer, seat);
    },

    leave(peer) {
      seats.delete(peer);
      deps.onStatus("dropped", peer);
    },

    localHash(h) {
      if (!hashing.due) return;
      hashing.due = false;
      mine.set(hashing.lastN, h);
      compare(hashing.lastN);
    },

    seatOf: (peer) => seats.get(peer),
    count: () => seq.n,
  };
}

/* ==================== a guest ==================== */

export type GuestSession = {
  intent: (a: Action) => void;
  receive: (text: string) => void;
  /* sent as soon as the channel opens */
  hello: () => void;
  localHash: (h: string) => void;
  seat: () => Seat | null;
};

export function guestSession(deps: SessionDeps & { onSeat: (s: Seat) => void }): GuestSession {
  const me = { seat: null as Seat | null };
  /* The number the next numbered action must carry. A gap means the stream
     this peer is replaying is not the stream the host sent, and applying past
     it would move the divergence away from where it happened. */
  const stream = { next: 1, stopped: false };
  const hashing: Hashing = { lastN: 0, due: false };

  return {
    intent(a) {
      const scope = scopeOf(a);
      /* The window's own: the open modal, the toast, the hand's order. */
      if (scope === "local") {
        deps.apply(a);
        return;
      }
      /* The clock's. A guest's timer fires exactly as the host's does; this
         is where it is dropped, which is why useGameLoop needs no idea that a
         session exists. */
      if (scope === "auto") return;
      deps.send("host", encodeMsg({ t: "req", a }));
    },

    receive(text) {
      const m = parseMsg(text);
      if (!m) return;
      switch (m.t) {
        case "welcome":
          if (m.v !== NET_VERSION) {
            deps.onStatus("version");
            return;
          }
          me.seat = m.seat;
          deps.onSeat(m.seat);
          deps.onStatus("live");
          return;
        case "act":
          if (stream.stopped) return;
          if (m.n !== stream.next) {
            stream.stopped = true;
            deps.onStatus("desync", `gap@${m.n}`);
            return;
          }
          stream.next++;
          hashing.lastN = m.n;
          if (m.a.type === "endTrick") hashing.due = true;
          deps.apply(m.a);
          return;
        case "bye":
          deps.onStatus("dropped");
          return;
        default:
          return;
      }
    },

    hello() {
      deps.send("host", encodeMsg({ t: "hello", v: NET_VERSION }));
    },

    localHash(h) {
      if (!hashing.due) return;
      hashing.due = false;
      deps.send("host", encodeMsg({ t: "hash", n: hashing.lastN, h }));
    },

    seat: () => me.seat,
  };
}
