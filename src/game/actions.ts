import type { Modal, Mode, Seat, SortMode } from "./types";

/* Every state change goes through one of these. The ones marked "auto" are
   dispatched by the clock itself (see schedule.ts); the player never sends
   them. */

export type Action =
  /* the run */
  | { type: "newRun"; seed?: string }
  | { type: "startBlind" }
  | { type: "skipBlind" }
  /* the side deck */
  | { type: "pickSideCard"; uid: string }
  | { type: "cancelSidePick" }
  | { type: "swapHandCard"; uid: string }
  | { type: "finishSwap" }
  /* the declaration */
  | { type: "aiDeclare" } /* auto */
  | { type: "declare"; decl: Mode }
  | { type: "finishDeclare" } /* auto */
  /* sooli */
  | { type: "acceptSooli" }
  | { type: "declineSooli" }
  | { type: "sooliGive"; uid: string }
  | { type: "startSooliPlay" }
  /* tricks */
  | { type: "playCard"; p: Seat; uid: string }
  | { type: "aiPlay" } /* auto */
  | { type: "resolveTrick" } /* auto */
  | { type: "endTrick" } /* auto */
  | { type: "showHandResult" } /* auto */
  | { type: "nextDeal" }
  /* the shop */
  | { type: "toShop" }
  | { type: "buy"; index: number }
  | { type: "reroll" }
  | { type: "sellJoker"; index: number }
  | { type: "sellSideCard"; index: number }
  | { type: "nextBlind" }
  /* consumables */
  | { type: "useConsumable"; index: number }
  /* the hand */
  | { type: "setSortMode"; mode: SortMode }
  | { type: "reorderHand"; uids: string[] }
  | { type: "moveCard"; uid: string; dir: -1 | 1 }
  /* the interface */
  | { type: "openModal"; modal: Modal }
  | { type: "closeModal" }
  | { type: "dismissToast"; id: number }
  | { type: "clearPop" };
