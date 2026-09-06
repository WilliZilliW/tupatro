import { useContext } from "react";
import { SeatContext } from "./seatContext";
import type { Seat } from "../game/types";

/* The seat the screen is drawn for. Defaults to 0, which is where the human
   sits in single player. */
export function useViewSeat(): Seat {
  return useContext(SeatContext);
}
