import { useDispatch } from "../../hooks/useGame";
import { useNet, useSpectating } from "../../hooks/useNet";
import { LOCALE_NAMES } from "../../i18n";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";

/* The menu asks the one question the two doors answer: are you playing alone?
  Behind Single player is everything played against the game — the roguelike,
  Tuppi-Rummikub and the two match modes — and behind Multiplayer is the
  lobby, which is the whole of playing with other people. Nothing else: the
  chair table in front of a player who has no company is what made this screen
  confusing, and no run, no challenge and no match is dispatched from here.

  Single player is shut while a session is live, and shut twice: `disabled` on
  the button and an early return in its own handler, because a guard that is
  drawn and not enforced is one restyle away from gone. Both reasons are in
  menu.singleLive — resuming a run of your own is this window walking out of a
  session it has not left, and every mode behind that door builds a one-person
  board a guest's chair could not play. Multiplayer carries no `disabled` at
  all: the lobby's footer is where Hang up lives, so shutting that door would
  be shutting the way out.

  The reason line belongs to the button rather than to the session: a shared
  table draws neither door — MoveButton renders nothing for it — so a line
  telling it to hang up in the lobby would explain a control that is not on
  screen and name an exit it has no route to. Its way out is the banner's own
  Leave.

  Rules is the only reading matter left here. SCORES went down behind Single
  player with the run it records: the board ScoresModal draws is readScores()
  alone, the solo roguelike's own top ten on tupatro-scores-v1, and no session
  ever writes to it. That the door is shut while a session is live therefore
  costs a live window nothing it could have used — and the rail's own SCORES
  button, and the copies on the blind select, the shop, the deal end and the
  cash-out, are untouched, because those exist for an overlay covering the
  rail rather than for this menu.

  The way back onto the game already behind the menu is not drawn here any
  more: it moved into the lobby's own footers, the only screens a live
  session can raise the menu from, so this screen reads no game state at
  all — offline the two Continues on the single-player screen are the whole
  route back. */
export function Menu() {
  const dispatch = useDispatch();
  const net = useNet();
  const spectating = useSpectating();
  const { t, locale, setLocale } = useI18n();
  /* The button shows the language you would switch to, not the current one —
     the same convention the rail's own langbtn uses. */
  const other = locale === "fi" ? "en" : "fi";

  return (
    <Overlay>
      <h2>{t("menu.title")}</h2>
      <p className="dek">{t("menu.dek")}</p>
      <div className="menubtns">
        <div className="menugroup">
          <MoveButton
            className="btn"
            disabled={net.live}
            onClick={() => {
              if (net.live) return;
              dispatch({ type: "showMenu", view: "single" });
            }}
          >
            {t("btn.singlePlayer")}
          </MoveButton>
          {net.live && !spectating && <p className="dek">{t("menu.singleLive")}</p>}
          <MoveButton
            className="btn ghost"
            onClick={() => dispatch({ type: "showMenu", view: "lobby" })}
          >
            {t("btn.multiplayer")}
          </MoveButton>
        </div>
        <div className="menugroup">
          <button
            className="btn ghost"
            onClick={() => dispatch({ type: "openModal", modal: "rules" })}
          >
            {t("btn.rules")}
          </button>
          <button className="langbtn" title={LOCALE_NAMES[other]} onClick={() => setLocale(other)}>
            {LOCALE_NAMES[other]}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
