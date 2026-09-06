import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAVE_VERSION, dehydrate } from "../game/save";
import { createRun } from "../game/state";
import { GameProvider } from "./GameContext";
import { useDispatch, useGameState } from "./useGame";
import type { ScoreRow } from "../game/scores";
import type { GameState } from "../game/types";

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
