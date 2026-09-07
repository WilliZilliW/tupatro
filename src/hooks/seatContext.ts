import { createContext } from "react";
import type { Seat } from "../game/types";

/* ==================== the viewing seat ====================
   Which seat the screen is drawn for. This is a React context and not a field
   on GameState, deliberately: under lockstep multiplayer every peer runs the
   same reducer over the same actions and every peer's state has to be
   byte-identical, so "which seat am I" would be the one field that differed
   and the one field that could desync a replay. It is a property of the
   window, not of the game.

   The context is in a module of its own so the provider's file exports only
   components (Fast Refresh) and a test can wrap the tree with the same
   context — the same three-file split localeContext.ts / LocaleProvider.tsx /
   useI18n.ts uses.

   The lobby is what makes it move: a run started at seat 2 leaves the window
   looking at seat 0 until useSeatSync corrects it. */
export const SeatContext = createContext<Seat>(0);

/* The setter, in a context of its own so a component that only reads the seat
   does not re-render when the setter's identity changes.

   The default is a no-op rather than a throw: a window with no SeatProvider
   simply cannot change seats, and GameProvider is rendered without one in
   several tests. A throwing default would turn "no provider" into a crash in
   the one place the seat does not matter. */
export const SetSeatContext = createContext<(p: Seat) => void>(() => {});
