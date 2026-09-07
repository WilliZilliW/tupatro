import type { ChallengeId, MenuView, Modal, Mode, Seat, SortMode } from "./types";

/* Every state change goes through one of these. The ones marked "auto" are
   dispatched by the clock itself (see schedule.ts); the player never sends
   them.

   A player action names the seat it acts for. The reducer checks that seat is
   marked "human" in g.seats and, where the phase is turn-based, that it is
   that seat's turn — the state is seat-absolute, so nothing may assume the
   sender is seat 0. */

export type Action =
  /* the run */
  | { type: "newRun"; seed?: string }
  | { type: "startBlind" }
  | { type: "skipBlind" }
  /* challenges */
  | { type: "startChallenge"; id: ChallengeId; seed?: string }
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
  | { type: "buy"; index: number; replace?: number }
  | { type: "reroll" }
  | { type: "sellJoker"; index: number }
  | { type: "sellSideCard"; index: number }
  | { type: "nextBlind" }
  /* consumables */
  | { type: "useConsumable"; index: number }
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
