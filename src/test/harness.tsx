import { render, type RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import type { ReactNode } from "react";
import { GameDispatchContext, GameStateContext } from "../hooks/gameContexts";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { gameReducer } from "../game/reducer";
import { createRun } from "../game/state";
import { CONSUMABLES, JOKERS, VOUCHERS, BOSSES } from "../game/content";
import { card } from "./factories";
import type { Action } from "../game/actions";
import type { GameState } from "../game/types";
import type { Locale } from "../i18n";

type DispatchSpy = ReturnType<typeof vi.fn<(a: Action) => void>>;

export type Rendered = RenderResult & { dispatch: DispatchSpy };

/* Renders any component with a given game state and locale. Dispatch is a
   spy, so a test can see what a button would send. */
export function renderWith(state: GameState, ui: ReactNode, locale: Locale = "fi"): Rendered {
  const dispatch: DispatchSpy = vi.fn<(a: Action) => void>();
  const result = render(
    <LocaleProvider initial={locale}>
      <GameDispatchContext.Provider value={dispatch}>
        <GameStateContext.Provider value={state}>{ui}</GameStateContext.Provider>
      </GameDispatchContext.Provider>
    </LocaleProvider>,
  );
  return Object.assign(result, { dispatch });
}

/* A run with something in every slot, so no branch renders empty. */
export function loadedState(over: Partial<GameState> = {}): GameState {
  const dealt = gameReducer(createRun("RENDERTEST"), { type: "startBlind" });
  return {
    ...dealt,
    screen: null,
    phase: "play",
    turn: 0,
    jokers: [JOKERS[0], JOKERS[7], JOKERS[JOKERS.length - 1]],
    consumables: [CONSUMABLES[0], CONSUMABLES[1]],
    vouchers: [VOUCHERS[0].id],
    /* One card whose twin is in hand and one whose twin went to another seat,
       so both sides of the tuppipakka's same-card rule render. */
    sideDeck: [
      card(dealt.hands[0][0].s, dealt.hands[0][0].r, "wild"),
      card(dealt.hands[1][0].s, dealt.hands[1][0].r, "stone"),
    ],
    boss: BOSSES[0],
    target: 1000,
    blindScore: 250,
    mode: "rami",
    ramSeat: 1,
    ramTeam: 1,
    shows: [
      { decl: "nolo", card: card("S", 5) },
      { decl: "rami", card: card("H", 6) },
      { decl: "nolo", card: card("C", 7) },
      { decl: "nolo", card: card("D", 8) },
    ],
    ...over,
  };
}
