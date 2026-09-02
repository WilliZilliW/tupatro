import { useContext, type Dispatch } from "react";
import { GameDispatchContext, GameStateContext } from "./gameContexts";
import type { Action } from "../game/actions";
import type { GameState } from "../game/types";

export function useGameState(): GameState {
  const s = useContext(GameStateContext);
  if (!s) throw new Error("useGameState outside GameProvider");
  return s;
}

export function useDispatch(): Dispatch<Action> {
  const d = useContext(GameDispatchContext);
  if (!d) throw new Error("useDispatch outside GameProvider");
  return d;
}
