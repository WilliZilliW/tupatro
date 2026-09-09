import { useDispatch } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

/* The one door to playing with other people, and only the door: hosting,
   joining and hanging up are reached from here, so the start menu carries one
   button instead of three and the lobby no longer has to hold Hang up twice.

   Nothing about the session is on GameState — it is a property of the window,
   like the viewing seat — so this view reads it all from the net context and
   dispatches nothing but which menu view to draw next. */
export function Multi() {
  const dispatch = useDispatch();
  const net = useNet();
  const { t, fmt } = useI18n();

  /* How many chairs answered. Only a host has chairs to count: a guest's stay
     at OFF_CHAIRS because nothing patches them, so its line carries no number
     rather than a misleading 0. */
  const connected = net.chairs.filter((c) => c.kind === "open" && c.state === "connected").length;

  return (
    <Overlay>
      <h2>{t("multi.title")}</h2>
      <p className="dek">{t("multi.dek")}</p>
      {/* Classed so the view stays findable: the door draws no box of its own,
          and .multisession is only there while a session is live. */}
      <div className="row multi">
        <button className="btn" onClick={() => dispatch({ type: "showMenu", view: "lobby" })}>
          {t("btn.hostGame")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "showMenu", view: "join" })}>
          {t("btn.joinGame")}
        </button>
        {/* The only route to hanging up, which is why the Multiplayer button
            that leads here is never disabled. */}
        {net.live && (
          <button className="btn ghost" onClick={net.hangUp}>
            {t("btn.hangUp")}
          </button>
        )}
      </div>
      {net.live && (
        <p className="dek multisession">
          {net.role === "host" ? t("multi.hosting", { n: fmt(connected) }) : t("multi.joined")}
        </p>
      )}
      <div className="row">
        <button className="btn ghost" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}
