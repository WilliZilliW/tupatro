import { createContext, type Dispatch } from "react";
import type { Action } from "../game/actions";
import type { GameState } from "../game/types";

/* The contexts in a module of their own, so a test can inject any state
   without production code needing a door built for tests.

   State and dispatch are separate: a component that only dispatches does not
   re-render when the state changes. */
export const GameStateContext = createContext<GameState | null>(null);
export const GameDispatchContext = createContext<Dispatch<Action> | null>(null);
