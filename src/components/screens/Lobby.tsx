import { useState } from "react";
import { SEATS, partnerOf } from "../../game/constants";
import { useDispatch } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import { Overlay } from "../Overlay";
import type { Seat } from "../../game/types";

/* The seat picker, reserved for the multiplayer mode and not dead code.

   Nothing shipped dispatches `{ type: "showMenu", view: "lobby" }` any more:
   New Game starts a single-player run at seat 0 on the spot, because a player
   who cannot have company is handed a decision they never asked to make. The
   view stays built, routed by Screens.tsx and covered by render.test.tsx so
   it cannot rot. What has to arrive before it has a route in again is the
   transport increment — a session to join, and a lobby that joins one rather
   than configuring a local run. Until then it seats one human and the picker
   is the only thing that would have used a seat other than 0.

   Which chair a player sits in is not a rule of tuppi: the club's sheet and
   korttipeliopas both state every positional rule relative to the dealer or
   the elder hand, and neither names a seat for anybody. So the lobby may seat
   the player anywhere without touching the game. What it changes is which hand
   a given seed deals them and where the rotating deal puts them.

   The four rows are the seats in engine order, not the deal order: the dealer
   rotates on every startBlind and nextDeal, so "you declare first here" would
   be false after one deal.

   The pending selection is component-local useState — the same shape
   SwapPanel's selection uses. It is never on GameState and so never in the
   save: the run it describes does not exist until Start is clicked. Nor does
   the lobby move the viewing seat; it dispatches newRun and lets useSeatSync
   follow the state, so there is exactly one writer of the window's seat. */
export function Lobby() {
  const dispatch = useDispatch();
  const { t, seatName } = useI18n();
  const you = useViewSeat();
  const [sel, setSel] = useState<Seat>(you);

  return (
    <Overlay>
      <h2>{t("lobby.title")}</h2>
      <p className="dek">{t("lobby.dek")}</p>
      <div className="seatpicks">
        {([0, 1, 2, 3] as Seat[]).map((p) => (
          <button
            key={p}
            className={cx("seatpick", p === sel && "selected")}
            data-seat={p}
            onClick={() => setSel(p)}
          >
            <span className="av">{SEATS[p].short}</span>
            <span className="who">{seatName(p, sel)}</span>
          </button>
        ))}
      </div>
      <p className="dek">{t("lobby.partner", { who: seatName(partnerOf(sel), sel) })}</p>
      <div className="row lobbyfoot">
        <button className="btn" onClick={() => dispatch({ type: "newRun", seat: sel })}>
          {t("btn.startRun")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}
