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

   Nothing sets it yet: there is no seat picker and no multiplayer. It exists
   so the literal 0 leaves the components. */
export const SeatContext = createContext<Seat>(0);
