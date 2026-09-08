import type { ChallengeId, MenuView, Modal, Mode, Seat, SeatKind, SortMode } from "./types";

/* Every state change goes through one of these. The ones marked "auto" are
   dispatched by the clock itself (see schedule.ts); the player never sends
   them.

   A player action names the seat it acts for. The reducer checks that seat is
   marked "human" in g.seats and, where the phase is turn-based, that it is
   that seat's turn — the state is seat-absolute, so nothing may assume the
   sender is seat 0. The five economy actions carry a seat for the same reason:
   the wallet they charge is economies[p], not the run's. */

export type Action =
  /* the run */
  /* `seat` is the chair the lobby seated the player in; omitted it is 0, which
     is where every run started before the lobby existed. `seats` is the whole
     table, which only a hosted game has an opinion about: it names every
     chair at once, so one to four of them can be human. Given both, `seats`
     wins — it is the more specific statement. */
  | { type: "newRun"; seed?: string; seat?: Seat; seats?: [SeatKind, SeatKind, SeatKind, SeatKind] }
  | { type: "startBlind" }
  | { type: "skipBlind" }
  /* challenges */
  /* `seats` is the whole table at once, which is what the lobby's four chairs
     say: one kind per chair, so any number of people from one to four, and
     partners as well as opponents. Omitted, the reducer seats one human in the
     parked run's own chair — which is the board Tuppi-Rummikub has always had.
     An all-AI table is expressible here and refused by a runtime guard in the
     reducer, because nextTick would stall on it at the first player-gated
     phase and never deal a card. */
  | {
      type: "startChallenge";
      id: ChallengeId;
      seed?: string;
      seats?: [SeatKind, SeatKind, SeatKind, SeatKind];
    }
  | { type: "leaveChallenge" }
  /* the laydown */
  | { type: "layCards"; p: Seat; combos: string[][] }
  | { type: "passLaydown"; p: Seat }
  | { type: "aiLaydown" } /* auto */
  /* the side deck */
  | { type: "pickSideCard"; p: Seat; uid: string }
  | { type: "finishSwap"; p: Seat }
  /* the declaration */
  | { type: "aiDeclare" } /* auto */
  | { type: "declare"; p: Seat; decl: Mode }
  | { type: "finishDeclare" } /* auto */
  /* sooli */
  | { type: "acceptSooli"; p: Seat }
  | { type: "declineSooli"; p: Seat }
  | { type: "sooliGive"; p: Seat; uid: string }
  | { type: "startSooliPlay"; p: Seat }
  /* tricks */
  | { type: "playCard"; p: Seat; uid: string }
  | { type: "aiPlay" } /* auto */
  | { type: "resolveTrick" } /* auto */
  | { type: "endTrick" } /* auto */
  | { type: "showHandResult" } /* auto */
  | { type: "nextDeal" }
  /* the shop */
  | { type: "toShop" }
  | { type: "buy"; p: Seat; index: number; replace?: number }
  | { type: "reroll"; p: Seat }
  | { type: "sellJoker"; p: Seat; index: number }
  | { type: "sellSideCard"; p: Seat; index: number }
  | { type: "nextBlind" }
  /* consumables */
  | { type: "useConsumable"; p: Seat; index: number }
  /* the hand */
  | { type: "setSortMode"; p: Seat; mode: SortMode }
  | { type: "reorderHand"; p: Seat; uids: string[] }
  | { type: "moveCard"; p: Seat; uid: string; dir: -1 | 1 }
  /* the interface */
  | { type: "showMenu"; view: MenuView }
  | { type: "closeMenu" }
  | { type: "openModal"; modal: Modal }
  | { type: "closeModal" }
  | { type: "dismissToast"; id: number }
  | { type: "clearPop" };
