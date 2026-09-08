import { render, type RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import type { ReactNode } from "react";
import { GameDispatchContext, GameStateContext } from "../hooks/gameContexts";
import { NetContext, OFF_CHAIRS, type Net } from "../hooks/netContext";
import { SeatProvider } from "../hooks/SeatProvider";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { gameReducer } from "../game/reducer";
import { createRun } from "../game/state";
import { CONSUMABLES, JOKERS, VOUCHERS, BOSSES } from "../game/content";
import { card, splitEcon, withEcon, type StateOver } from "./factories";
import type { Action } from "../game/actions";
import type { GameState, Seat } from "../game/types";
import type { Locale } from "../i18n";

type DispatchSpy = ReturnType<typeof vi.fn<(a: Action) => void>>;

export type Rendered = RenderResult & { dispatch: DispatchSpy; net: Net };

/* A session, spied. Every method is a vi.fn, so a test can see what the lobby
   would ask the transport to do without a WebRTC stack — jsdom has none, and
   the relay itself is tested in src/net/ where no browser is involved. The
   fields default to a window with no session, which is what every other
   component renders under. */
export function stubNet(over: Partial<Net> = {}): Net {
  return {
    role: "off",
    live: false,
    seat: null,
    status: null,
    chairs: OFF_CHAIRS,
    answer: null,
    problem: null,
    lan: false,
    setLan: vi.fn(),
    setChair: vi.fn(),
    invite: vi.fn(),
    connect: vi.fn(),
    join: vi.fn(),
    start: vi.fn(),
    hangUp: vi.fn(),
    dispatch: vi.fn(),
    seatsFor: () => ["human", "ai", "ai", "ai"],
    ...over,
  };
}

/* Renders any component with a given game state, locale and viewing seat.
   Dispatch is a spy, so a test can see what a button would send. The seat
   defaults to 0, which is where single player sits. */
export function renderWith(
  state: GameState,
  ui: ReactNode,
  locale: Locale = "fi",
  seat: Seat = 0,
  net: Net = stubNet(),
): Rendered {
  const dispatch: DispatchSpy = vi.fn<(a: Action) => void>();
  const result = render(
    <LocaleProvider initial={locale}>
      <SeatProvider seat={seat}>
        <NetContext.Provider value={net}>
          <GameDispatchContext.Provider value={dispatch}>
            <GameStateContext.Provider value={state}>{ui}</GameStateContext.Provider>
          </GameDispatchContext.Provider>
        </NetContext.Provider>
      </SeatProvider>
    </LocaleProvider>,
  );
  return Object.assign(result, { dispatch, net });
}

/* A run with something in every slot, so no branch renders empty. */
export function loadedState(over: StateOver = {}): GameState {
  const dealt = gameReducer(createRun("RENDERTEST"), { type: "startBlind" });
  /* An economy field named at the top level folds into seat 0's wallet, so a
     fixture reads the way it did before the wallet moved. */
  const [rest, econ] = splitEcon(over);
  const base: GameState = {
    ...dealt,
    screen: null,
    phase: "play",
    turn: 0,
    boss: BOSSES[0],
    target: 1000,
    blindScore: 250,
    /* Tricks are indexed by team, and a split that is neither 0-0 nor even
       makes the tally plate and the deal-end line draw both halves. */
    tricks: [4, 3],
    mode: "rami",
    ramSeat: 1,
    ramTeam: 1,
    shows: [
      { decl: "nolo", card: card("S", 5) },
      { decl: "rami", card: card("H", 6) },
      { decl: "nolo", card: card("C", 7) },
      { decl: "nolo", card: card("D", 8) },
    ],
    ...rest,
  };
  return withEcon(base, 0, {
    jokers: [JOKERS[0], JOKERS[7], JOKERS[JOKERS.length - 1]],
    consumables: [CONSUMABLES[0], CONSUMABLES[1]],
    vouchers: [VOUCHERS[0].id],
    /* One card whose twin is in hand and one whose twin went to another seat,
       so both sides of the tuppipakka's same-card rule render. */
    sideDeck: [
      card(dealt.hands[0][0].s, dealt.hands[0][0].r, "wild"),
      card(dealt.hands[1][0].s, dealt.hands[1][0].r, "stone"),
    ],
    ...econ,
  });
}
