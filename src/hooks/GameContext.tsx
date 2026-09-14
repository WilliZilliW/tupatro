import { useEffect, useReducer, type ReactNode } from "react";
import { gameReducer } from "../game/reducer";
import { dehydrate, resumable } from "../game/save";
import { soloBoard } from "../game/rules";
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
  clearChallengeRun,
  clearRun,
  readBestAnte,
  readChallengeScores,
  readRaceScores,
  readRun,
  readScores,
  writeBestAnte,
  writeChallengeRun,
  writeChallengeScores,
  writeRaceScores,
  writeRun,
  writeScores,
} from "../game/storage";
import { GameDispatchContext, GameStateContext } from "./gameContexts";
import { NetContext } from "./netContext";
import type { GameState, MatchId } from "../game/types";
import { useGameLoop } from "./useGameLoop";
import { useNetGame } from "./useNetGame";
import { useSeatSync } from "./useSeatSync";

/* An explicit seed is a new run by definition, so a saved one is not even
   read: a rerun from the end screen must not resume the run it replaces. It
   skips the menu too — a seed is a run the player has already chosen.

   The boot read goes through `resumable` rather than `rehydrate` directly:
   a two-human board can only be written by a hosted run that hung up on a
   screen (the main run's write side carries no soloBoard guard — see
   game/save.ts), and booting into a save nobody here can act for would stall
   at the first player-gated phase. `null` is this slot's own id: the main
   run's key names no challenge. */
function initialState(seed?: string): GameState {
  if (seed) return { ...createRun(seed, readBestAnte()), runStarted: true };
  const resumed = resumable(readRun(), null, readBestAnte());
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
     host assigned it — so it is handed in rather than inferred. The shared
     table holds no chair at all and is not seated: its orientation is fixed
     for the whole match. */
  useSeatSync(state, net.seat, net.role === "table");

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
    /* A challenge is never written to tupatro-run-v1 and never clears it: the
       main run's snapshot stands untouched through one, and the main run
       itself is parked in the state. What a challenge does write is its own
       slot, `tupatro-run-<id>-v1`, at these same boundaries — cleared instead
       of written on the two result screens, right before its board row is
       filed, and addChallengeScore/addRaceScore collapse a repeat exactly as
       addScore does. */
    /* Any challenge, not one id: the no-write guard is correct for every
       alternate rule set, and narrowing it to an id is the reverse of the
       mistake the reducer's branches had. Which board is written does depend
       on the mode, so that is the id test. */
    if (state.challenge !== null) {
      /* A board row belongs to a match the window is still in. The shared
         table's Leave hangs up and raises the start menu over the result it
         was watching, and showMenu does not clear the screen underneath — so
         this effect runs once more with net.live false and, without the
         guard, files a race the display never played for a pair it has no
         relation to. The general menu guard below cannot cover it: the
         gameover branch has to stay ahead of that one, and no challenge is
         ever resumed into its end screen, so nothing here needs to run under
         a menu. */
      if (state.menu !== null) return;
      const id = state.challenge;
      /* A slot of its own now, at exactly the boundaries the main run's
         snapshot already uses: written on every screen but the result
         screens, and cleared on those instead, right before the board row is
         filed exactly as it was before this slot existed. Gated on
         soloBoard: a two-human board has no single seat to hand a resumed
         game back to, so it is written to nobody's `resumeGame` at all. */
      if (screen.kind === "raceover") {
        if (soloBoard(state)) clearChallengeRun(id);
        /* The mode's own board, never the other's: a RaceRow fits both, so a
           traditional match filed under the race's key would be sorted
           against a scale it has nothing to do with. */
        const mode: MatchId = id === "tuppi" ? "tuppi" : "race";
        writeRaceScores(mode, addRaceScore(readRaceScores(mode), raceRowFor(state, Date.now())));
        return;
      }
      if (screen.kind === "challengeover") {
        if (soloBoard(state)) clearChallengeRun(id);
        writeChallengeScores(
          id,
          addChallengeScore(readChallengeScores(id), challengeRowFor(state, Date.now())),
        );
        return;
      }
      if (soloBoard(state)) writeChallengeRun(id, dehydrate(state));
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
