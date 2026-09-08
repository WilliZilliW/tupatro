import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { raceWinner } from "../game/race";
import { ownerTeam } from "../game/rules";
import { SAVE_VERSION, dehydrate } from "../game/save";
import { nextTick, waitingSeat } from "../game/schedule";
import { writeScores } from "../game/storage";
import { createRun } from "../game/state";
import { basicPolicy } from "../test/bot";
import { GameProvider } from "./GameContext";
import { useNet } from "./useNet";
import { unpackSdp } from "../net/signal";
import { OFFER_SDP } from "../net/sdp.fixture";
import type { Net } from "./netContext";
import { SeatProvider } from "./SeatProvider";
import { useDispatch, useGameState } from "./useGame";
import { useViewSeat } from "./useSeat";
import { useGameLoop } from "./useGameLoop";
import type { Action } from "../game/actions";
import type { ScoreRow } from "../game/scores";
import type { GameState, Seat } from "../game/types";

/* The key is part of the contract, so the tests name it rather than importing
   it: renaming it would orphan every save already written. */
const RUN_KEY = "tupatro-run-v1";
const SCORES_KEY = "tupatro-scores-v1";

/* Reads the store the way a reload would: whatever is on disk right now. */
const stored = () => {
  const raw = localStorage.getItem(RUN_KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
};

function Probe() {
  const g = useGameState();
  const dispatch = useDispatch();
  return (
    <div>
      <span data-testid="seed">{g.seed}</span>
      <span data-testid="ante">{g.ante}</span>
      <span data-testid="screen">{g.screen?.kind ?? "none"}</span>
      <span data-testid="menu">{g.menu ?? "none"}</span>
      <span data-testid="runStarted">{String(g.runStarted)}</span>
      <button onClick={() => dispatch({ type: "startBlind" })}>startBlind</button>
      <button onClick={() => dispatch({ type: "openModal", modal: "rules" })}>openRules</button>
      <button onClick={() => dispatch({ type: "closeMenu" })}>closeMenu</button>
      <button onClick={() => dispatch({ type: "newRun" })}>newRun</button>
    </div>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;

/* runStarted is what a real save carries: writeRun only ever fires with the
   menu down, which is a run the player is in. */
const save = (over: Partial<GameState>): void => {
  const g: GameState = { ...createRun("SAVED"), ante: 3, runStarted: true, ...over };
  localStorage.setItem(RUN_KEY, JSON.stringify(dehydrate(g)));
};

/* jsdom here provides no Storage at all — which is why storage.ts guards
   every call, and why the game runs without one. These tests are about what
   is written, so they install a minimal in-memory store. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  /* The clock is data (schedule.ts), so a still clock is enough here: no tick
     may fire between the render and the assertion. */
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GameProvider picks up a saved run", () => {
  it("resumes it when no seed is given", () => {
    save({ screen: { kind: "blindselect" } });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(read("seed")).toBe("SAVED");
    expect(read("ante")).toBe("3");
  });

  it("opens on the start menu, offering a Continue back into the save", () => {
    save({ screen: { kind: "shop" }, phase: "shop" });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(read("seed")).toBe("SAVED");
    expect(read("ante")).toBe("3");
    expect(read("menu")).toBe("start");
    expect(read("runStarted")).toBe("true");
  });

  it("opens on the start menu with no Continue when there is no save", () => {
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(read("menu")).toBe("start");
    expect(read("runStarted")).toBe("false");
  });

  /* An explicit seed is a run the player already chose, so it skips the menu
     the way it skips the save. */
  it("shows no menu when a seed is given", () => {
    render(
      <GameProvider seed="FRESH">
        <Probe />
      </GameProvider>,
    );
    expect(read("menu")).toBe("none");
    expect(read("runStarted")).toBe("true");
  });

  it("prefers an explicit seed and never reads the run key", () => {
    save({ screen: { kind: "blindselect" } });
    const getItem = vi.spyOn(localStorage, "getItem");
    render(
      <GameProvider seed="FRESH">
        <Probe />
      </GameProvider>,
    );
    expect(read("seed")).toBe("FRESH");
    expect(read("ante")).toBe("1");
    expect(getItem.mock.calls.map((c) => c[0])).not.toContain(RUN_KEY);
    getItem.mockRestore();
  });

  it("starts a fresh run when the save cannot be read", () => {
    localStorage.setItem(RUN_KEY, "{ not json");
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(read("seed")).not.toBe("SAVED");
    expect(read("ante")).toBe("1");
  });
});

describe("GameProvider writes at screen boundaries", () => {
  it("saves the run it resumed onto a shop screen", () => {
    save({ screen: { kind: "shop" }, phase: "shop" });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    /* Boot lands on the menu and nothing is written while it is up, so the
       snapshot below is the one Continue put the player back into. */
    fireEvent.click(screen.getByText("closeMenu"));
    expect(read("menu")).toBe("none");
    expect(read("screen")).toBe("shop");
    const out = stored()!;
    expect(out.v).toBe(SAVE_VERSION);
    expect(out.ante).toBe(3);
    expect((out.screen as { kind: string }).kind).toBe("shop");
  });

  /* The menu is up over a run the player has not returned to yet, and New
     Game may still replace it: what is on disk stays what was on disk. */
  it("writes nothing while the start menu is up", () => {
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(read("menu")).toBe("start");
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
    fireEvent.click(screen.getByText("newRun"));
    expect(read("menu")).toBe("none");
    expect((stored()!.screen as { kind: string }).kind).toBe("blindselect");
  });

  it("does not write once the deal is under way", () => {
    save({ screen: { kind: "blindselect" } });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    fireEvent.click(screen.getByText("closeMenu"));
    fireEvent.click(screen.getByText("startBlind"));
    /* The deal is running: no screen, so the snapshot must still be the one
       taken at the blind select. */
    expect(read("screen")).toBe("none");
    expect((stored()!.screen as { kind: string }).kind).toBe("blindselect");
  });

  it("clears the save when the run is over", () => {
    save({ screen: { kind: "gameover" }, phase: "handend" });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(read("screen")).toBe("gameover");
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
  });

  it("clears the save when the run is won", () => {
    save({ screen: { kind: "victory" }, phase: "handend" });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(read("screen")).toBe("victory");
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
  });
});

/* The board is a second key, written by the same effect that clears the run.
   It is deliberately not cleared with it: a run that ends leaves a trace. */
describe("GameProvider files the finished run on the board", () => {
  const board = () => {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw === null ? null : (JSON.parse(raw) as { v: number; rows: ScoreRow[] });
  };

  it("records a lost run and leaves the board behind the cleared save", () => {
    save({ screen: { kind: "gameover" }, phase: "handend", blindIdx: 2, runScore: 8400 });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
    expect(board()!.rows).toEqual([
      { seed: "SAVED", ante: 3, blindIdx: 2, runScore: 8400, won: false, at: expect.any(Number) },
    ]);
  });

  it("records a won run as won", () => {
    save({ screen: { kind: "victory" }, phase: "handend", blindIdx: 1, runScore: 51000 });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    const rows = board()!.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].won).toBe(true);
    expect(rows[0].runScore).toBe(51000);
  });

  it("files it once however often the effect runs again", () => {
    save({ screen: { kind: "gameover" }, phase: "handend", runScore: 1234 });
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    /* A state change the screen survives: the effect depends on the whole
       state, so it runs again and addScore must collapse the same row. */
    fireEvent.click(screen.getByText("openRules"));
    expect(read("screen")).toBe("gameover");
    expect(board()!.rows).toHaveLength(1);
  });
});

/* A challenge is never saved and never clears the save: the main run's
   snapshot and the main board stand untouched through one, byte for byte.
   The whole challenge is driven through the real provider — no timers, the
   same way drive.ts does it — so what is asserted is the effect the app runs,
   not a headless copy of it. */
describe("GameProvider leaves the run's own keys alone during a challenge", () => {
  const CHAL_KEY = "tupatro-challenge-rummikub-v1";

  /* The provider owns its state, so the probe hands it back and takes the
     next action through a holder rather than a prop: a prop would need a
     re-render between every step. */
  const holder: { g: GameState | null } = { g: null };
  const pending: { action: Action | null } = { action: null };

  function ChallengeProbe() {
    const g = useGameState();
    const dispatch = useDispatch();
    holder.g = g;
    return (
      <div>
        <span data-testid="challenge">{g.challenge ?? "none"}</span>
        <span data-testid="screen">{g.screen?.kind ?? "none"}</span>
        <button onClick={() => pending.action && dispatch(pending.action)}>send</button>
      </div>
    );
  }

  const send = (action: Action) => {
    pending.action = action;
    fireEvent.click(screen.getByText("send"));
  };

  /* Plays a whole challenge from the start menu to its own end screen. */
  function playThrough() {
    send({ type: "startChallenge", id: "rummikub" });
    for (let guard = 0; guard < 6000; guard++) {
      const g = holder.g!;
      if (g.screen?.kind === "challengeover") return g;
      if (g.screen?.kind === "dealend") {
        send({ type: "nextDeal" });
        continue;
      }
      if (g.phase === "play" && g.turn === 0) {
        send({ type: "playCard", p: 0, uid: basicPolicy.chooseCard(g, 0) });
        continue;
      }
      if (g.phase === "laydown" && g.layTurn === 0) {
        const combos = basicPolicy.laydown(g, 0);
        send(combos ? { type: "layCards", p: 0, combos } : { type: "passLaydown", p: 0 });
        continue;
      }
      const tick = nextTick(g);
      if (!tick) throw new Error(`stuck in ${g.phase}`);
      send(tick.action);
    }
    throw new Error("the challenge did not finish");
  }

  it("writes nothing to the run key while a challenge is up", () => {
    save({ screen: { kind: "shop" }, phase: "shop" });
    const before = localStorage.getItem(RUN_KEY);

    render(
      <GameProvider>
        <ChallengeProbe />
      </GameProvider>,
    );
    send({ type: "startChallenge", id: "rummikub" });
    expect(read("challenge")).toBe("rummikub");
    /* A state change the challenge survives: the effect depends on the whole
       state, so this is exactly where a missing guard would write. */
    send({ type: "openModal", modal: "rules" });
    expect(localStorage.getItem(RUN_KEY)).toBe(before);
  });

  it("leaves the run and the main board byte-identical across a whole challenge", () => {
    save({ screen: { kind: "blindselect" } });
    writeScores([{ seed: "OLD", ante: 3, blindIdx: 1, runScore: 900, won: false, at: 5 }]);
    const runBefore = localStorage.getItem(RUN_KEY);
    const boardBefore = localStorage.getItem(SCORES_KEY);
    expect(runBefore).not.toBeNull();
    expect(boardBefore).not.toBeNull();

    render(
      <GameProvider>
        <ChallengeProbe />
      </GameProvider>,
    );
    const done = playThrough();
    expect(done.screen?.kind).toBe("challengeover");

    expect(localStorage.getItem(RUN_KEY)).toBe(runBefore);
    expect(localStorage.getItem(SCORES_KEY)).toBe(boardBefore);
  });

  it("files the run on the challenge's own board instead", () => {
    save({ screen: { kind: "blindselect" } });
    render(
      <GameProvider>
        <ChallengeProbe />
      </GameProvider>,
    );
    expect(localStorage.getItem(CHAL_KEY)).toBeNull();
    const done = playThrough();

    const board = JSON.parse(localStorage.getItem(CHAL_KEY)!) as {
      v: number;
      rows: Array<{ seed: string; score: number }>;
    };
    expect(board.rows).toHaveLength(1);
    expect(board.rows[0].seed).toBe(done.seed);
    expect(board.rows[0].score).toBe(done.runScore);
  });

  it("gives the parked run back on leaveChallenge, and only then writes again", () => {
    save({ screen: { kind: "blindselect" } });
    render(
      <GameProvider>
        <ChallengeProbe />
      </GameProvider>,
    );
    /* Continue first: the menu-up guard would otherwise hide the write. */
    send({ type: "closeMenu" });
    send({ type: "startChallenge", id: "rummikub" });
    expect(holder.g!.seed).not.toBe("SAVED");
    send({ type: "leaveChallenge" });
    expect(holder.g!.challenge).toBeNull();
    expect(holder.g!.seed).toBe("SAVED");
    expect(holder.g!.menu).toBe("start");
  });
});

/* g.seats is saved and the viewing seat is not, so the window has to follow
   the run back. Without it a run resumed at seat 2 would leave every panel
   dispatching for a seat marked "ai": every guard refuses and the deal never
   advances.

   The probe renders useViewSeat() inside a real SeatProvider wrapped around a
   real GameProvider, which is the mounting main.tsx uses. */
describe("the window follows the run's own seats", () => {
  function SeatProbe() {
    const you = useViewSeat();
    const dispatch = useDispatch();
    return (
      <div>
        <span data-testid="you">{you}</span>
        <button onClick={() => dispatch({ type: "newRun", seat: 3 })}>newRunAt3</button>
      </div>
    );
  }

  const mount = () =>
    render(
      <SeatProvider>
        <GameProvider>
          <SeatProbe />
        </GameProvider>
      </SeatProvider>,
    );

  it("resumes a run seated at 2 with the window at 2", () => {
    save({ screen: { kind: "blindselect" }, seats: ["ai", "ai", "human", "ai"] });
    mount();
    expect(read("you")).toBe("2");
  });

  /* The delivered save seats the human at 0, which is the default: a hook that
     moved the seat unconditionally would show up here. */
  it("leaves a run seated at 0 alone", () => {
    save({ screen: { kind: "blindselect" } });
    mount();
    expect(read("you")).toBe("0");
  });

  it("follows a newRun that seats the player at 3", () => {
    mount();
    expect(read("you")).toBe("0");
    fireEvent.click(screen.getByText("newRunAt3"));
    expect(read("you")).toBe("3");
  });
});

/* ==================== the hot seat ====================
   With two humans on one board the window has to follow the seat the game is
   waiting on: the panels dispatch for useViewSeat() and the reducer refuses an
   action for a seat whose turn it is not, so without this a two-human race
   stalls in silence with no error at all.

   The clause has to sit *ahead* of the single-human "already human, leave it
   alone" early return, because with two humans the window can be looking at a
   human seat and still at the wrong one. That is what the first case below
   catches: seat 0 is human, so the old guard would have returned. */
describe("the window follows the acting seat in a hot seat", () => {
  const holder: { g: GameState | null } = { g: null };
  const pending: { action: Action | null } = { action: null };

  function HotProbe() {
    const g = useGameState();
    const you = useViewSeat();
    const dispatch = useDispatch();
    holder.g = g;
    return (
      <div>
        <span data-testid="you">{you}</span>
        <span data-testid="phase">{g.phase}</span>
        <button onClick={() => pending.action && dispatch(pending.action)}>send</button>
      </div>
    );
  }

  const send = (action: Action) => {
    pending.action = action;
    fireEvent.click(screen.getByText("send"));
  };

  const mount = () =>
    render(
      <SeatProvider>
        <GameProvider>
          <HotProbe />
        </GameProvider>
      </SeatProvider>,
    );

  it("moves to the clockwise opponent once seat 0 has declared", () => {
    mount();
    send({ type: "startChallenge", id: "race", humans: 2 });
    expect(holder.g!.seats).toEqual(["human", "human", "ai", "ai"]);
    /* createRun's dealer is 3, so the elder hand is seat 0 and it declares
       first. The window is already there. */
    expect(read("you")).toBe("0");
    expect(holder.g!.declSeq[holder.g!.declIdx]).toBe(0);

    send({ type: "declare", p: 0, decl: "nolo" });
    /* Seat 1 is the other human, so the clock stops for it and the window
       follows. A `seats[you] === "human"` early return ahead of this clause
       would leave the view at 0 and the match would never advance. */
    expect(holder.g!.seats[Number(read("you")) as 0 | 1 | 2 | 3]).toBe("human");
    expect(read("you")).toBe("1");
  });

  it("walks all four seats through a declaration round", () => {
    mount();
    send({ type: "startChallenge", id: "race", humans: 4 });
    for (const seat of [0, 1, 2, 3]) {
      expect(read("you")).toBe(String(seat));
      send({ type: "declare", p: seat as 0 | 1 | 2 | 3, decl: "nolo" });
    }
    /* The fourth declaration leaves the round complete but not yet closed:
       finishDeclare is the clock's step, so the timer has to run. */
    expect(holder.g!.declIdx).toBe(4);
    act(() => void vi.advanceTimersByTime(1000));
    expect(holder.g!.phase).toBe("play");
    expect(Number(read("you"))).toBe(holder.g!.turn);
  });

  /* Single player is unchanged: nothing moves the seat when only one is
     human, in a race or in a main-game run. */
  it("moves no seat in a single-human race", () => {
    mount();
    send({ type: "startChallenge", id: "race", humans: 1 });
    expect(read("you")).toBe("0");
    send({ type: "declare", p: 0, decl: "nolo" });
    expect(read("you")).toBe("0");
  });

  it("moves no seat in a single-human main run", () => {
    mount();
    send({ type: "newRun" });
    send({ type: "startBlind" });
    expect(read("you")).toBe("0");
    send({ type: "declare", p: 0, decl: "rami" });
    expect(read("you")).toBe("0");
  });
});

/* A race writes its own board and nothing else: the main run's snapshot, the
   main board and the rummikub board all stand untouched through one. */
describe("a race writes only its own board", () => {
  const RACE_KEY = "tupatro-race-v1";
  const CHAL_KEY = "tupatro-challenge-rummikub-v1";

  const holder: { g: GameState | null } = { g: null };
  const pending: { action: Action | null } = { action: null };

  function RaceProbe() {
    const g = useGameState();
    const dispatch = useDispatch();
    holder.g = g;
    return (
      <div>
        <span data-testid="screen">{g.screen?.kind ?? "none"}</span>
        <button onClick={() => pending.action && dispatch(pending.action)}>send</button>
      </div>
    );
  }

  const send = (action: Action) => {
    pending.action = action;
    fireEvent.click(screen.getByText("send"));
  };

  /* Plays a whole race through the real provider — no timers, the same way
     drive.ts does it — so what is asserted is the effect the app runs. */
  function playThrough() {
    send({ type: "startChallenge", id: "race" });
    for (let guard = 0; guard < 60_000; guard++) {
      const g = holder.g!;
      if (g.screen?.kind === "raceover") return g;
      if (g.screen?.kind === "dealend") {
        send({ type: "nextDeal" });
        continue;
      }
      const me = waitingSeat(g);
      if (me !== null) {
        if (g.phase === "declare") {
          send({ type: "declare", p: me, decl: basicPolicy.declare(g, me) });
          continue;
        }
        if (g.phase === "play") {
          send({ type: "playCard", p: me, uid: basicPolicy.chooseCard(g, me) });
          continue;
        }
        if (g.phase === "soolioffer") {
          send({ type: "declineSooli", p: me });
          continue;
        }
        throw new Error(`no move for ${g.phase}`);
      }
      const tick = nextTick(g);
      if (!tick) throw new Error(`stuck in ${g.phase}`);
      send(tick.action);
    }
    throw new Error("the race did not finish");
  }

  it("leaves the run key and both other boards byte-identical", () => {
    save({ screen: { kind: "blindselect" } });
    writeScores([{ seed: "OLD", ante: 3, blindIdx: 1, runScore: 900, won: false, at: 5 }]);
    localStorage.setItem(
      CHAL_KEY,
      JSON.stringify({ v: 1, rows: [{ seed: "C", score: 9, at: 1 }] }),
    );
    const runBefore = localStorage.getItem(RUN_KEY);
    const boardBefore = localStorage.getItem(SCORES_KEY);
    const chalBefore = localStorage.getItem(CHAL_KEY);

    render(
      <GameProvider>
        <RaceProbe />
      </GameProvider>,
    );
    const done = playThrough();
    expect(done.screen?.kind).toBe("raceover");

    expect(localStorage.getItem(RUN_KEY)).toBe(runBefore);
    expect(localStorage.getItem(SCORES_KEY)).toBe(boardBefore);
    expect(localStorage.getItem(CHAL_KEY)).toBe(chalBefore);
  });

  it("files the match on tupatro-race-v1", () => {
    save({ screen: { kind: "blindselect" } });
    render(
      <GameProvider>
        <RaceProbe />
      </GameProvider>,
    );
    expect(localStorage.getItem(RACE_KEY)).toBeNull();
    const done = playThrough();

    const board = JSON.parse(localStorage.getItem(RACE_KEY)!) as {
      v: number;
      rows: Array<{ seed: string; won: boolean; deals: number; score: number }>;
    };
    /* One row, not two: addRaceScore collapses the provider's write and the
       screen's own merge, which differ only in the timestamp. */
    expect(board.rows).toHaveLength(1);
    expect(board.rows[0].seed).toBe(done.seed);
    expect(board.rows[0].deals).toBe(done.raceDeal);
    expect(board.rows[0].score).toBe(done.runScore);
    expect(board.rows[0].won).toBe(raceWinner(done) === ownerTeam(done));
  });
});

/* The one piece of timing in the project that is not data: a real-time cap on
   a human's thinking, so it lives in useGameLoop and not in nextTick. */
describe("the laydown's sixty seconds", () => {
  function Loop({ g, send }: { g: GameState; send: (a: Action) => void }) {
    useGameLoop(g, send);
    return null;
  }

  const lay = (over: Partial<GameState> = {}): GameState => ({
    ...createRun("LAYCLOCK"),
    challenge: "rummikub",
    phase: "laydown",
    screen: null,
    menu: null,
    layTurn: 0,
    layNo: 0,
    ...over,
  });

  it("passes the turn at sixty seconds, and not before", () => {
    const send = vi.fn();
    render(<Loop g={lay()} send={send} />);
    act(() => void vi.advanceTimersByTime(59_000));
    expect(send).not.toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
    act(() => void vi.advanceTimersByTime(1_000));
    expect(send).toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
  });

  /* The dependency is the turn's number, not the state: a rejected lay toasts
     and leaves the turn where it was, and it must not hand the player another
     minute. */
  it("does not restart on a state change within the same turn", () => {
    const send = vi.fn();
    const { rerender } = render(<Loop g={lay()} send={send} />);
    act(() => void vi.advanceTimersByTime(50_000));
    rerender(<Loop g={lay({ toast: { id: 1, key: "toast.layOneCard" } })} send={send} />);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(send).toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
  });

  it("is gone once it is the opponents' turn", () => {
    const send = vi.fn();
    const { rerender } = render(<Loop g={lay()} send={send} />);
    rerender(<Loop g={lay({ layTurn: 1, layNo: 1 })} send={send} />);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(send).not.toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
  });

  it("is not set at all outside the laydown", () => {
    const send = vi.fn();
    render(<Loop g={lay({ phase: "shop", screen: { kind: "shop" } })} send={send} />);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(send).not.toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
  });

  /* Nothing advances behind the start menu — the law nextTick states on its
     first line — and the laydown's minute is no exception: the menu covers
     the panel, so a turn spent behind it is a turn the player was not allowed
     to take. */
  it("does not run while the start menu is up", () => {
    const send = vi.fn();
    render(<Loop g={lay({ menu: "start" })} send={send} />);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(send).not.toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
  });

  /* The rules modal is where the laydown's own rules are read. */
  it("does not run while a modal is up, and starts over when it closes", () => {
    const send = vi.fn();
    const { rerender } = render(<Loop g={lay({ modal: "rules" })} send={send} />);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(send).not.toHaveBeenCalledWith({ type: "passLaydown", p: 0 });

    rerender(<Loop g={lay()} send={send} />);
    act(() => void vi.advanceTimersByTime(59_000));
    expect(send).not.toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
    act(() => void vi.advanceTimersByTime(1_000));
    expect(send).toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
  });
});

/* ============================ a session ============================
   jsdom has no WebRTC, so the door in net/rtc.ts is given a stand-in. What is
   under test here is not the connection — the relay itself is tested in
   src/net/, where no browser is involved — but the two things GameProvider
   owes a session: the run is not written to disk, and the window sits in the
   chair the host took. */
class FakeChannel {
  readyState = "connecting";
  addEventListener() {}
  send() {}
  close() {}
}

class FakePeer {
  iceGatheringState = "complete";
  connectionState = "new";
  localDescription = { sdp: OFFER_SDP };
  addEventListener() {}
  createDataChannel() {
    return new FakeChannel();
  }
  createOffer() {
    return Promise.resolve({ type: "offer", sdp: OFFER_SDP });
  }
  setLocalDescription() {
    return Promise.resolve();
  }
  setRemoteDescription() {
    return Promise.resolve();
  }
  close() {}
}

describe("a hosted session", () => {
  const seen: { net: Net | null } = { net: null };

  function NetProbe() {
    const net = useNet();
    const g = useGameState();
    const dispatch = useDispatch();
    seen.net = net;
    return (
      <div>
        <span data-testid="live">{String(net.live)}</span>
        <span data-testid="netseat">{net.seat === null ? "none" : String(net.seat)}</span>
        <span data-testid="view">{String(useViewSeat())}</span>
        <span data-testid="screen">{g.screen?.kind ?? "none"}</span>
        <button onClick={() => dispatch({ type: "openModal", modal: "rules" })}>openRules</button>
      </div>
    );
  }

  const host = async (seat: Seat) => {
    await act(async () => {
      seen.net?.invite(seat);
    });
  };

  beforeEach(() => {
    seen.net = null;
    vi.stubGlobal("RTCPeerConnection", FakePeer);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes nothing to the run key while a session is live", async () => {
    save({ screen: { kind: "shop" }, phase: "shop" });
    expect(localStorage.getItem(RUN_KEY)).not.toBeNull();

    render(
      <SeatProvider seat={0}>
        <GameProvider>
          <NetProbe />
        </GameProvider>
      </SeatProvider>,
    );
    /* Down off the menu first, which is the state that writes. */
    act(() => {
      seen.net?.dispatch({ type: "closeMenu" });
    });
    await host(1);
    expect(read("live")).toBe("true");

    /* Watching the writes rather than comparing the bytes: a resumed run
       written again produces the identical string, so a byte comparison
       cannot tell a guarded effect from an unguarded one. It was written this
       way first, and the mutation walked straight through it. */
    const writes = vi.spyOn(localStorage, "setItem");
    fireEvent.click(screen.getByText("openRules"));
    expect(writes.mock.calls.map((c) => c[0]).filter((k) => k === RUN_KEY)).toEqual([]);
    /* Vacuity guard: the same click without a session does write. */
    writes.mockRestore();
    act(() => {
      seen.net?.hangUp();
    });
    const after = vi.spyOn(localStorage, "setItem");
    act(() => {
      seen.net?.dispatch({ type: "closeModal" });
    });
    expect(after.mock.calls.map((c) => c[0]).filter((k) => k === RUN_KEY)).not.toEqual([]);
    after.mockRestore();
  });

  it("seats the window in the chair the host took", async () => {
    render(
      <SeatProvider seat={0}>
        <GameProvider>
          <NetProbe />
        </GameProvider>
      </SeatProvider>,
    );
    expect(read("view")).toBe("0");
    await host(2);
    expect(read("netseat")).toBe("2");
    /* useSeatSync is still the only writer of the viewing seat; a session
       hands it a fact instead of leaving it to the single-human guess. */
    expect(read("view")).toBe("2");
    expect(seen.net?.chairs[2].kind).toBe("me");
  });

  it("builds one invitation per open chair and none for the rest", async () => {
    render(
      <SeatProvider seat={0}>
        <GameProvider>
          <NetProbe />
        </GameProvider>
      </SeatProvider>,
    );
    act(() => {
      seen.net?.setChair(1, "open");
      seen.net?.setChair(3, "open");
    });
    await host(0);
    const chairs = seen.net?.chairs ?? [];
    expect(chairs.filter((c) => c.code !== null).map((c) => c.seat)).toEqual([1, 3]);
    for (const c of chairs.filter((x) => x.code !== null)) {
      expect(unpackSdp("H", c.code ?? "").ok).toBe(true);
      expect(c.state).toBe("waiting");
    }
    expect(seen.net?.seatsFor()).toEqual(["human", "ai", "ai", "ai"]);
  });

  it("hangs up back to a window with no session", async () => {
    render(
      <SeatProvider seat={0}>
        <GameProvider>
          <NetProbe />
        </GameProvider>
      </SeatProvider>,
    );
    await host(3);
    expect(read("live")).toBe("true");
    act(() => {
      seen.net?.hangUp();
    });
    expect(read("live")).toBe("false");
    expect(read("netseat")).toBe("none");
  });
});
