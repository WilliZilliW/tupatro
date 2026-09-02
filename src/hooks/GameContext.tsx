import { useEffect, useReducer, type ReactNode } from "react";
import { gameReducer } from "../game/reducer";
import { createRun } from "../game/state";
import { readBestAnte, writeBestAnte } from "../game/storage";
import { GameDispatchContext, GameStateContext } from "./gameContexts";
import { useGameLoop } from "./useGameLoop";

export function GameProvider({ children, seed }: { children: ReactNode; seed?: string }) {
  const [state, dispatch] = useReducer(gameReducer, seed, (s) => createRun(s, readBestAnte()));

  useGameLoop(state, dispatch);

  /* The best ante is the only thing that persists between runs. */
  useEffect(() => {
    writeBestAnte(state.bestAnte);
  }, [state.bestAnte]);

  return (
    <GameDispatchContext.Provider value={dispatch}>
      <GameStateContext.Provider value={state}>{children}</GameStateContext.Provider>
    </GameDispatchContext.Provider>
  );
}
