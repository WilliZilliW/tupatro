import { createContext } from "react";
import type { Action } from "../game/actions";
import type { GuestRole } from "../net/protocol";
import type { SessionStatus } from "../net/session";
import type { Unpacked } from "../net/signal";
import type { MatchId, Seat, SeatKind } from "../game/types";

/* ============================ the session, as the window sees it ============
   None of this is on GameState, and that is the point. Under lockstep every
   peer runs the same reducer over the same actions and every peer's state has
   to be byte-identical, so which peer I am, who I am connected to and how the
   invitation is coming along are all properties of the *window* — exactly like
   the viewing seat, and for exactly the same reason. invariants.test.ts fails
   on a GameState field named after any of them. */

/* "table" is a shared display: a peer that holds no chair, draws the board and
   sends nothing. It is reachable only inside a live session — with no peer to
   advance the player-gated phases a board with no "human" seat would stall on
   the first one, which is why there is no offline spectator. */
export type NetRole = "off" | "host" | "guest" | "table";

/* Five of these are the parser's reading of the code; "refused" is the
   browser's reading of it. An answer that unpacks perfectly is still rejected
   by setRemoteDescription when the link's peer is already here — that
   connection is stable — so the reason cannot come from signal.ts and the host
   would otherwise be told nothing at all. */
export type SdpProblem = Extract<Unpacked, { ok: false }>["why"] | "refused";

/* What the host means a chair to be. "me" is the host's own, "hot" a person
   sitting at this same screen, "open" a chair a peer connects to, "ai" the
   game. Four kinds and not three because a race at one screen is a delivered
   capability: without "hot" the only way to seat a second person would be to
   connect a browser to itself. */
export type ChairKind = "me" | "hot" | "open" | "ai";

/* "table" is a chair whose invitation was answered by a shared display rather
   than by a player: the device is connected, the chair is not taken, and the
   game plays it. */
export type ChairState = "idle" | "inviting" | "waiting" | "connected" | "failed" | "table";

/* One invitation, as far as ICE has got. Offered before gathering finishes on
   purpose: on one network the first candidate is already enough, and a browser
   whose STUN server answers nothing would otherwise never hand over a code at
   all. Shared, because the shared table's invitation belongs to no chair and
   is otherwise exactly this. */
export type NetInvite = {
  code: string | null;
  candidates: number;
  complete: boolean;
  state: ChairState;
};

export type NetChair = NetInvite & {
  seat: Seat;
  kind: ChairKind;
};

export type Net = {
  role: NetRole;
  /* A session is running: the relay is between this window and the reducer. */
  live: boolean;
  /* This window's chair. The host chose it; a guest was told it. */
  seat: Seat | null;
  status: SessionStatus | null;
  chairs: NetChair[];
  /* The room's code while a room session is live, and null on the manual
     paste/QR route. It is what the lobby branches on: the two routes end in
     the same `role`, because above the door a room and a pasted invitation
     are the same session. */
  room: string | null;
  /* The guest's own half of the exchange, to hand back to the host. */
  answer: string | null;
  /* Why the last pasted code was refused. The reason travels as data and the
     lobby is what turns it into a sentence — the catalogue is typed, so a key
     built by concatenation would not compile. */
  problem: SdpProblem | null;
  lan: boolean;
  /* The one invitation that reserves no chair, built only when wantTable was
     on at the moment invite() ran. Null means the host did not ask for one. */
  tableInvite: NetInvite | null;
  wantTable: boolean;
  setWantTable: (on: boolean) => void;
  setLan: (on: boolean) => void;
  /* Which of the two match modes Start begins. The session's, like the chair
     plan and for the same reason: it is a property of the window that is
     hosting, never of GameState — every peer's state has to be byte-identical,
     and a guest learns the mode from the host's numbered startChallenge like
     it learns the seed and the seats. */
  match: MatchId;
  setMatch: (m: MatchId) => void;
  setChair: (seat: Seat, kind: ChairKind) => void;
  /* Take a chair and build one invitation per open chair, plus the shared
     table's if it was asked for. */
  invite: (seat: Seat) => void;
  /* Take a chair and open a room instead: one code for the whole table,
     handed out by voice. Chairs go to arrivals in seat order. */
  openRoom: (seat: Seat) => void;
  /* The guest, typing the code the host read out. A room's arrival is always
     a player: its chairs are handed out in seat order and a display that took
     one would eat it, so the shared table is offered on the code swap alone. */
  enterRoom: (code: string) => void;
  /* The host, taking an invitation's answer back — a chair's, or the shared
     table's. */
  connect: (seat: Seat | "table", code: string) => void;
  /* The joining device, taking the host's invitation, saying which of the two
     things it is. */
  join: (code: string, as: GuestRole) => void;
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
  room: null,
  answer: null,
  problem: null,
  lan: false,
  tableInvite: null,
  wantTable: false,
  setWantTable: nope,
  setLan: nope,
  match: "race",
  setMatch: nope,
  setChair: nope,
  invite: nope,
  openRoom: nope,
  enterRoom: nope,
  connect: nope,
  join: nope,
  start: nope,
  hangUp: nope,
  dispatch: nope,
  seatsFor: () => ["human", "ai", "ai", "ai"],
});
