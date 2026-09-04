import { useEffect, useReducer, type ReactNode } from "react";
import { gameReducer } from "../game/reducer";
import { dehydrate, rehydrate } from "../game/save";
import { createRun } from "../game/state";
import { clearRun, readBestAnte, readRun, writeBestAnte, writeRun } from "../game/storage";
import { GameDispatchContext, GameStateContext } from "./gameContexts";
import { useGameLoop } from "./useGameLoop";

/* An explicit seed is a new run by definition, so a saved one is not even
   read: a rerun from the end screen must not resume the run it replaces. */
function initialState(seed?: string) {
  if (seed) return createRun(seed, readBestAnte());
  return rehydrate(readRun(), readBestAnte()) ?? createRun(undefined, readBestAnte());
}

export function GameProvider({ children, seed }: { children: ReactNode; seed?: string }) {
  const [state, dispatch] = useReducer(gameReducer, seed, initialState);

  useGameLoop(state, dispatch);

  /* The best ante is what survives a run, the snapshot below is what survives
     a refresh. */
  useEffect(() => {
    writeBestAnte(state.bestAnte);
  }, [state.bestAnte]);

  /* Saved at screen boundaries only: mid-deal there is a pending tick, and a
     snapshot taken between an opponent's two cards would resume into a
     position the clock has already left. The consequence — a reload rewinds
     to the last screen and deals the same cards again — is accepted. */
  useEffect(() => {
    const screen = state.screen;
    if (!screen) return;
    if (screen.kind === "gameover" || screen.kind === "victory") {
      clearRun();
      return;
    }
    writeRun(dehydrate(state));
  }, [state]);

  return (
    <GameDispatchContext.Provider value={dispatch}>
      <GameStateContext.Provider value={state}>{children}</GameStateContext.Provider>
    </GameDispatchContext.Provider>
  );
}
