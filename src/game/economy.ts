import type { GameState, PlayerEconomy, Seat } from "./types";

/* ============================ a seat's wallet ============================
   The roguelike shell — the money, the jokers, the vouchers, the tuppipakka
   and the shop — is a property of a seat, and the seat is always a parameter.
   The pure core never asks which seat is *looking*: under lockstep
   multiplayer every peer runs the same reducer over the same actions, so a
   wallet resolved from the window would be the one value that differed
   between peers, and a card's chip value that depended on which window was
   open would desync a replay.

   That is why this module holds one function and no `myEcon(g)`. */
export function econOf(g: Pick<GameState, "economies">, p: Seat): PlayerEconomy {
  return g.economies[p];
}
