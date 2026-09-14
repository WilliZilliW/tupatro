import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { LOCALE_NAMES } from "../../i18n";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

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

  The return button is about the game already behind the menu rather than
  about a door, which is why it is drawn for a solo run too — closing the menu
  stays one click from every game. Its label reads that game and never the
  session: an open room with no match started still has the solo run behind
  it, and reading the session there said "Back to match" over a roguelike it
  had not replaced. */
export function Menu() {
  const { runStarted, challenge } = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const { t, locale, setLocale } = useI18n();
  /* The button shows the language you would switch to, not the current one —
     the same convention the rail's own langbtn uses. */
  const other = locale === "fi" ? "en" : "fi";
  const back =
    challenge === "rummikub"
      ? "menu.returnChallenge"
      : challenge !== null
        ? "menu.returnMatch"
        : "menu.returnGame";

  return (
    <Overlay>
      <h2>{t("menu.title")}</h2>
      <p className="dek">{t("menu.dek")}</p>
      <div className="menubtns">
        {runStarted && (
          <div className="menugroup">
            <button className="btn" onClick={() => dispatch({ type: "closeMenu" })}>
              {t(back)}
            </button>
          </div>
        )}
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
          {net.live && <p className="dek">{t("menu.singleLive")}</p>}
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
          <ScoresButton />
          <button className="langbtn" title={LOCALE_NAMES[other]} onClick={() => setLocale(other)}>
            {LOCALE_NAMES[other]}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
