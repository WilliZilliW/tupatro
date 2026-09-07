import { makeDeck, makeMint, mkCard } from "../game/cards";
import { createRun, newEconomy } from "../game/state";
import type { Card, Enhancement, GameState, PlayerEconomy, Seat, Suit } from "../game/types";

/* Test helpers. Cards come from a single mint, so uids stay unique even when
   the same card type is created twice. */
const mint = makeMint(0);

export const card = (s: Suit, r: number, enh?: Enhancement): Card => mkCard(mint, s, r, enh);

export const freshDeck = (): Card[] => makeDeck(makeMint(0));

/* A full game state, over which a test writes only the fields it cares about.
   The pure functions read only what they need, but a full object keeps the
   types strict and spares the test from tracking Pick signatures. */
/* ==================== the wallet in a fixture ====================
   The seventeen economy fields moved into economies[seat], and a fixture that
   had to name the seat for every joker would be unreadable. An override may
   still name them at the top level, the way the state did before the move,
   and they fold into seat 0's wallet — which is the seat single player and
   every fixture here plays from. */
export type StateOver = Partial<GameState> & Partial<PlayerEconomy>;

const ECON_KEYS = new Set(Object.keys(newEconomy()));

export function splitEcon(over: StateOver): [Partial<GameState>, Partial<PlayerEconomy>] {
  const state: Record<string, unknown> = {};
  const econ: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(over)) (ECON_KEYS.has(k) ? econ : state)[k] = v;
  return [state as Partial<GameState>, econ as Partial<PlayerEconomy>];
}

/* One seat's wallet, overwritten. Returns a new state: a fixture is built up
   by spreading, never mutated in place. */
export function withEcon(g: GameState, p: Seat, over: Partial<PlayerEconomy>): GameState {
  const economies = g.economies.map((e, i) =>
    i === p ? { ...e, ...over } : e,
  ) as GameState["economies"];
  return { ...g, economies };
}

/* The same fold for a state a test already holds: `withOver(g, { money: 9 })`
   is what `{ ...g, money: 9 }` was before the wallet moved. */
export function withOver(g: GameState, over: StateOver): GameState {
  const [rest, econ] = splitEcon(over);
  return withEcon({ ...g, ...rest }, 0, econ);
}

export function st(over: StateOver = {}): GameState {
  const [rest, econ] = splitEcon(over);
  return withEcon({ ...createRun("TEST"), mode: "rami", ramTeam: 0, ...rest }, 0, econ);
}
