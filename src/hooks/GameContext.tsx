import { useEffect, useReducer, type ReactNode } from "react";
import { gameReducer } from "../game/reducer";
import { dehydrate, rehydrate } from "../game/save";
import { createRun } from "../game/state";
import {
  addChallengeScore,
  addRaceScore,
  addScore,
  challengeRowFor,
  raceRowFor,
  rowFor,
} from "../game/scores";
import {
  clearRun,
  readBestAnte,
  readChallengeScores,
  readRaceScores,
  readRun,
  readScores,
  writeBestAnte,
  writeChallengeScores,
  writeRaceScores,
  writeRun,
  writeScores,
} from "../game/storage";
import { GameDispatchContext, GameStateContext } from "./gameContexts";
import { NetContext } from "./netContext";
import type { GameState } from "../game/types";
import { useGameLoop } from "./useGameLoop";
import { useNetGame } from "./useNetGame";
import { useSeatSync } from "./useSeatSync";

/* An explicit seed is a new run by definition, so a saved one is not even
   read: a rerun from the end screen must not resume the run it replaces. It
   skips the menu too — a seed is a run the player has already chosen. */
function initialState(seed?: string): GameState {
  if (seed) return { ...createRun(seed, readBestAnte()), runStarted: true };
  const resumed = rehydrate(readRun(), readBestAnte());
  /* Boot lands on the menu either way. Whether Continue is on it is
     runStarted, which rehydrate sets and createRun leaves false. */
  return { ...(resumed ?? createRun(undefined, readBestAnte())), menu: "start" };
}

export function GameProvider({ children, seed }: { children: ReactNode; seed?: string }) {
  const [state, apply] = useReducer(gameReducer, seed, initialState);

  /* The session owns the dispatch every consumer gets. Offline it is `apply`
     itself; hosting or joining, it is the relay's — which numbers a shared
     action, sends a guest's as a request, and drops a guest's clock. Nothing
     below this line knows which of the two it is holding, the clock
     included. */
  const net = useNetGame(state, apply);
  const dispatch = net.dispatch;

  useGameLoop(state, dispatch);
  /* The window follows the run's own seats: a resumed run seated at 2, or one
     the lobby just started there, must not leave the player looking at a seat
     they cannot act for. In a session the chair is not a guess at all — the
     host assigned it — so it is handed in rather than inferred. */
  useSeatSync(state, net.seat);

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
    /* A networked run is never written, and never clears what is there.
       `seats` is saved and a session is not, so a resumed board naming humans
       with no peers behind them would stall on the first gated phase:
       nextTick returns null for a "human" seat and nobody would be there to
       act. The single-player snapshot underneath is left exactly as it was,
       which is also why the game-over branch below is skipped — clearing it
       would throw away a run this session never touched. */
    if (net.live) return;
    /* A challenge run is never written to tupatro-run-v1 and never clears it:
       the main run's snapshot stands untouched through one, and the main run
       itself is parked in the state. Its own board is the only thing a
       challenge writes, and addChallengeScore collapses a repeat exactly as
       addScore does. */
    /* Any challenge, not one id: the no-write guard is correct for every
       alternate rule set, and narrowing it to an id is the reverse of the
       mistake the reducer's branches had. Which board is written does depend
       on the mode, so that is the id test. */
    if (state.challenge !== null) {
      if (screen.kind === "raceover") {
        writeRaceScores(addRaceScore(readRaceScores(), raceRowFor(state, Date.now())));
        return;
      }
      if (screen.kind !== "challengeover") return;
      const id = state.challenge;
      writeChallengeScores(
        id,
        addChallengeScore(readChallengeScores(id), challengeRowFor(state, Date.now())),
      );
      return;
    }
    if (screen.kind === "gameover" || screen.kind === "victory") {
      /* The run is over: its snapshot goes, its row stays. addScore collapses
         a row equal on everything but the timestamp, so this effect running
         again — StrictMode, or any later state change — files the same run
         once. */
      clearRun();
      const won = screen.kind === "victory";
      writeScores(addScore(readScores(), rowFor(state, won, Date.now())));
      return;
    }
    /* The start menu is up over a run the player has not returned to yet:
       New Game may still replace it, so the snapshot on disk stays the one
       that was there. A fresh boot with no save writes nothing at all. */
    if (state.menu !== null) return;
    writeRun(dehydrate(state));
  }, [state, net.live]);

  return (
    <NetContext.Provider value={net}>
      <GameDispatchContext.Provider value={dispatch}>
        <GameStateContext.Provider value={state}>{children}</GameStateContext.Provider>
      </GameDispatchContext.Provider>
    </NetContext.Provider>
  );
}
