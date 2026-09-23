import { RPS_ROUNDS, SM, teamOf } from "../../game/constants";
import { rpsCompare } from "../../game/rps";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import { PlayingCard } from "../PlayingCard";
import { Panels } from "../panels/Panels";
import type { Card } from "../../game/types";

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
   field. There used to be a round-by-round history log here too, to the
   felt's own top-left — removed for clashing with the rest of the felt's own
   visuals (see rpsHistory's own removal note in types.ts).

   Every element the round touches is drawn in every phase, at the same size,
   so nothing on the felt moves when a round turns over. Before either of you
   has revealed, "You"'s own slot is `.rpsslot`, an empty outline the same
   footprint as a card — never absent — and the outcome line reads
   `rps.choosing` instead of vanishing, so the honours' rules below it never
   shift. `revealRps` flips the phase to rpsreveal in the same tick a card is
   clicked, so `.rpsslot` becomes a `Turned` card (back first, then turned,
   both in CSS) rather than a second explicit "picked" state — the empty
   outline is what makes that swap read as a back landing on a slot that was
   already there, not a box growing out of nowhere.

   This is the whole of the mode's own screen: Panels() draws nothing at all
   for rpsthrow, so the felt is on screen without a #declpanel box centred
   over it. */
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
                {/* Empty until you have revealed — the same fixed-size slot
                    a card fills once revealRps flips the phase, so the row's
                    own height never depends on whether one is drawn here
                    yet. */}
                {revealed && mine ? (
                  <Turned card={mine} away={cmp !== null && cmp <= 0} />
                ) : (
                  <span className="rpsslot" />
                )}
              </span>
              <span className="rpscard">
                <b>{t("rps.opponent")}</b>
                {/* Already drawn before the player can act (see rps.ts's own
                    comment), so its back sits here through the whole rpsthrow
                    phase rather than a bare card count — the same card, turned
                    face up by Turned once revealed is true. */}
                {revealed ? (
                  theirs && <Turned card={theirs} away={cmp !== null && cmp >= 0} />
                ) : (
                  <span className="rpscardback" />
                )}
              </span>
            </div>
            {/* Always drawn, never absent, so the honours' rules below it
                never shift when a round turns over: rps.choosing fills the
                same line while nobody has revealed yet. Keyed so the fade-in
                animation (see .rpsoutcome in index.css) replays each time
                the text actually changes meaning, rather than only once. */}
            <div
              className={cx("rpsoutcome", revealed && "revealed")}
              key={revealed ? `out-${g.rpsRound}` : "choosing"}
            >
              {revealed
                ? tie
                  ? t("rps.tied")
                  : won
                    ? t("rps.roundWon")
                    : t("rps.roundLost")
                : t("rps.choosing")}
            </div>
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

/* Both cards are placed face down and turn together, a beat later: the back is
   an overlay on the card and the turn is a CSS animation with a delay, so the
   reveal needs no timer of its own and no extra phase — resolveRps's own
   2000ms tick, the delay between hands (1.3s after the 0.7s turn itself), is
   the window it fits inside. The slot is keyed by uid, so it mounts once per
   round and the animation plays exactly once, the same reason the trick's
   drop animation needs no bookkeeping.

   Whichever card does not stand alone as the winner gets a second animation
   once it has finished turning: `.rpsaway` spins it and carries it off the
   felt, in place of just sitting there. That is the losing card on an
   ordinary round — one card away, one card kept — and *both* cards on a tie,
   since neither beat the other; only a round with an actual winner leaves a
   card behind. It started as Sofia's own effect (she always loses her round)
   and is now every non-winning card's, `cmp` decides it rather than
   `isSofia`. It starts at .8s, after the .7s turn is done, and finishes by
   1.25s, comfortably inside the 2s the card has before an ordinary round
   clears rpsCards for the next one. */
function Turned({ card, away }: { card: Card; away: boolean }) {
  /* Plain PlayingCard, no "hcard" — that class carries the hand row's own
     overlap (a negative margin) and hover-lift, neither of which belongs to
     a lone card sitting on the felt, and the margin alone would pull this
     card left of where .rpsslot and .rpscardback sit, undoing the fixed
     layout the empty slot exists for. Bare .card still resizes at every
     breakpoint .rpsslot and .rpscardback do (see index.css: the two general
     1080px/820px steps and the short-felt block), so the three stay the
     same size at every width without needing "hcard" for it. */
  return (
    <span className={cx("rpsflip", away && "rpsaway")} key={card.uid}>
      <PlayingCard card={card} />
      <span className="rpsdown" />
    </span>
  );
}
