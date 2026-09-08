import { createContext } from "react";
import type { Action } from "../game/actions";
import type { SessionStatus } from "../net/session";
import type { Unpacked } from "../net/signal";
import type { Seat, SeatKind } from "../game/types";

/* ============================ the session, as the window sees it ============
   None of this is on GameState, and that is the point. Under lockstep every
   peer runs the same reducer over the same actions and every peer's state has
   to be byte-identical, so which peer I am, who I am connected to and how the
   invitation is coming along are all properties of the *window* — exactly like
   the viewing seat, and for exactly the same reason. invariants.test.ts fails
   on a GameState field named after any of them. */

export type NetRole = "off" | "host" | "guest";

export type SdpProblem = Extract<Unpacked, { ok: false }>["why"];

/* What the host means a chair to be. "me" is the host's own, "hot" a person
   sitting at this same screen, "open" a chair a peer connects to, "ai" the
   game. Four kinds and not three because a race at one screen is a delivered
   capability: without "hot" the only way to seat a second person would be to
   connect a browser to itself. */
export type ChairKind = "me" | "hot" | "open" | "ai";

export type ChairState = "idle" | "inviting" | "waiting" | "connected" | "failed";

export type NetChair = {
  seat: Seat;
  kind: ChairKind;
  /* The invitation for this chair, as far as ICE has got. Offered before
     gathering finishes on purpose: on one network the first candidate is
     already enough, and a browser whose STUN server answers nothing would
     otherwise never hand over a code at all. */
  code: string | null;
  candidates: number;
  complete: boolean;
  state: ChairState;
};

export type Net = {
  role: NetRole;
  /* A session is running: the relay is between this window and the reducer. */
  live: boolean;
  /* This window's chair. The host chose it; a guest was told it. */
  seat: Seat | null;
  status: SessionStatus | null;
  chairs: NetChair[];
  /* The guest's own half of the exchange, to hand back to the host. */
  answer: string | null;
  /* Why the last pasted code was refused. The reason travels as data and the
     lobby is what turns it into a sentence — the catalogue is typed, so a key
     built by concatenation would not compile. */
  problem: SdpProblem | null;
  lan: boolean;
  setLan: (on: boolean) => void;
  setChair: (seat: Seat, kind: ChairKind) => void;
  /* Take a chair and build one invitation per open chair. */
  invite: (seat: Seat) => void;
  /* The host, taking a chair's answer back. */
  connect: (seat: Seat, code: string) => void;
  /* The guest, taking the host's invitation. */
  join: (code: string) => void;
  /* The host, starting the run every peer will build from the same seed. */
  start: (seed?: string) => void;
  hangUp: () => void;
  /* The whole point: every dispatch in the app goes through here. */
  dispatch: (a: Action) => void;
  seatsFor: () => [SeatKind, SeatKind, SeatKind, SeatKind];
};

export const OFF_CHAIRS: NetChair[] = [0, 1, 2, 3].map((p) => ({
  seat: p as Seat,
  kind: p === 0 ? ("me" as const) : ("ai" as const),
  code: null,
  candidates: 0,
  complete: false,
  state: "idle" as const,
}));

const nope = () => {};

/* A window with no provider is a window with no session — every method a
   no-op, the same shape the viewing seat's setter uses. */
export const NetContext = createContext<Net>({
  role: "off",
  live: false,
  seat: null,
  status: null,
  chairs: OFF_CHAIRS,
  answer: null,
  problem: null,
  lan: false,
  setLan: nope,
  setChair: nope,
  invite: nope,
  connect: nope,
  join: nope,
  start: nope,
  hangUp: nope,
  dispatch: nope,
  seatsFor: () => ["human", "ai", "ai", "ai"],
});
