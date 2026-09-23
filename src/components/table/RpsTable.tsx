import { RPS_ROUNDS, SM, rankLabel, teamOf } from "../../game/constants";
import { rpsCompare } from "../../game/rps";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import { PlayingCard } from "../PlayingCard";
import { Panels } from "../panels/Panels";
import type { Card, GameState, Seat } from "../../game/types";

/* Instead of the ordinary felt for a mode with no trick at all: the round
   score, "round n of RPS_ROUNDS", the opponent's own card — face down while
   the round is undecided, since it is already drawn before the player can
   act (see rps.ts's own comment) — and the two revealed cards once it is
   turned. The suit-to-throw legend and the honours' rules are drawn every
   round, not just the first: they are the one thing on this felt a player
   may still need mid-match, unlike the now-deleted "the opponent's card is
   already drawn" line, which the face-down card already shows for itself.
   The outcome is computed from rpsCompare() rather than stored — see
   rpsCards's own comment in types.ts: there is deliberately no "last result"
   field.

   This is the whole of the mode's own screen: Panels() draws nothing at all
   for rpsthrow, so the felt is on screen without a #declpanel box centred
   over it. RpsHistory, to the felt's own top-left, is every round already
   played, own component below. */
export function RpsTable() {
  const g = useGameState();
  const you = useViewSeat();
  const team = teamOf(you);
  const { t, fmt } = useI18n();

  const revealed = g.phase === "rpsreveal";
  const mine = revealed ? g.rpsCards[team] : null;
  const theirs = revealed ? g.rpsCards[1 - team] : null;
  const cmp = mine && theirs ? rpsCompare(mine, theirs) : null;
  const tie = cmp === 0;
  const won = cmp !== null && cmp > 0;

  return (
    <div className="tablewrap">
      <div className="felt">
        <div className="rpsfeltrow">
          <RpsHistory history={g.rpsHistory} you={you} />
          <div className="rpsboard">
            <div className="rpsscore">
              {fmt(g.rpsWins[team])}–{fmt(g.rpsWins[1 - team])}
            </div>
            {/* The round number is capped at the last round: the phase stays
                rpsreveal while the result screen is up, and rpsRound has already
                been incremented past the third round by then. */}
            <div className="rpsline">
              {t("rps.round", {
                n: fmt(Math.min(g.rpsRound + 1, RPS_ROUNDS)),
                total: fmt(RPS_ROUNDS),
              })}
            </div>
            <div className="rpsrow">
              <span className="rpscard">
                <b>{t("rps.you")}</b>
                {revealed && mine && <Turned card={mine} lost={cmp !== null && cmp < 0} />}
              </span>
              <span className="rpscard">
                <b>{t("rps.opponent")}</b>
                {/* Already drawn before the player can act (see rps.ts's own
                    comment), so its back sits here through the whole rpsthrow
                    phase rather than a bare card count — the same card, turned
                    face up by Turned once revealed is true. */}
                {revealed ? (
                  theirs && <Turned card={theirs} lost={cmp !== null && cmp > 0} />
                ) : (
                  <span className="rpscardback" />
                )}
              </span>
            </div>
            {revealed && (
              <div className="rpsoutcome">
                {tie ? t("rps.tied") : won ? t("rps.roundWon") : t("rps.roundLost")}
              </div>
            )}
            <div className="rpslegend">
              <span>
                {SM.H.g} {t("rps.throw.paper")}
              </span>
              <span>
                {SM.S.g} {t("rps.throw.rock")}
              </span>
              <span>
                {SM.D.g} {t("rps.throw.scissors")}
              </span>
              <span>
                {SM.C.g} {t("rps.throw.foil")}
              </span>
            </div>
            <div className="rpsline fine">{t("rps.foilRule")}</div>
            <div className="rpsline fine">{t("rps.clubsRule")}</div>
            <div className="rpsline fine">{t("rps.sofiaRule")}</div>
          </div>
        </div>
        <Panels />
      </div>
    </div>
  );
}

/* Every round already decided, oldest first, cards and winner both — anchored
   to the felt's own top-left corner rather than centred with .rpsboard (see
   .rpshistory's own align-self in index.css), and sized so all twelve rows
   fit in a single column with nothing to scroll: plain suit-coloured rank
   text rather than a PlayingCard, since PlayingCard's own internal text is a
   fixed size and clips well before a card shrinks small enough for twelve of
   them to fit. Empty on the first round by construction (nothing has
   resolved yet), so it draws nothing at all then. `cards` is team-indexed
   exactly like rpsCards was that round, so a viewer's own card and the
   opponent's are picked out here the same way the live round already does. */
function RpsHistory({ history, you }: { history: GameState["rpsHistory"]; you: Seat }) {
  const team = teamOf(you);
  const { t, fmt } = useI18n();

  if (history.length === 0) return null;

  return (
    <div className="rpshistory">
      {history.map((h, i) => {
        const mine = h.cards[team];
        const theirs = h.cards[1 - team];
        const outcome = h.winner === "tie" ? "tie" : h.winner === team ? "won" : "lost";
        const label =
          outcome === "tie"
            ? t("score.drawn")
            : outcome === "won"
              ? t("score.won")
              : t("score.lost");
        return (
          <div className={cx("rpshistrow", outcome)} key={i}>
            <span className="rpshistn">{fmt(i + 1)}</span>
            <span className={cx("rpshistcard", "s-" + mine.s)}>
              {rankLabel(mine.r)}
              {SM[mine.s].g}
            </span>
            <span className={cx("rpshistcard", "s-" + theirs.s)}>
              {rankLabel(theirs.r)}
              {SM[theirs.s].g}
            </span>
            <span className="rpshistlbl">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* Both cards are placed face down and turn together, a beat later: the back is
   an overlay on the card and the turn is a CSS animation with a delay, so the
   reveal needs no timer of its own and no extra phase — resolveRps's own
   1700ms tick (a full second after the 0.7s turn itself) is the window it
   fits inside. The slot is keyed by uid, so it mounts once per round and the
   animation plays exactly once, the same reason the trick's drop animation
   needs no bookkeeping.

   Whichever card lost the round gets a second animation once it has finished
   turning: `.rpslost` spins it and carries it off the felt, in place of just
   sitting there — a tie leaves both cards alone, since neither lost. It
   started as Sofia's own effect (she always loses her round) and is now
   every losing card's, `cmp` decides it rather than `isSofia`. It starts at
   .8s, after the .7s turn is done, and finishes by 1.25s, comfortably inside
   the 1.7s the card has before an ordinary round clears rpsCards for the
   next one. */
function Turned({ card, lost }: { card: Card; lost: boolean }) {
  return (
    <span className={cx("rpsflip", lost && "rpslost")} key={card.uid}>
      <PlayingCard card={card} className="hcard" />
      <span className="rpsdown" />
    </span>
  );
}
