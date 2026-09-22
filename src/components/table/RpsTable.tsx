import { RPS_ROUNDS, SM, teamOf } from "../../game/constants";
import { rpsCompare, rpsFoe } from "../../game/rps";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";
import { Panels } from "../panels/Panels";
import type { Card } from "../../game/types";

/* Instead of the ordinary felt for a mode with no trick at all: the round
   score, "round n of RPS_ROUNDS", the opponent's remaining card count while
   the round is undecided, the two revealed cards once it is, and — on the
   first round alone — the suit-to-throw legend the whole match is read by.
   The outcome is computed from rpsCompare() rather than stored — see
   rpsCards's own comment in types.ts: there is deliberately no "last result"
   field. The opponent's card is never drawn on screen before the player's
   own reveal — a UI choice, not a rule: the card is readable in devtools
   like every hand in this project already is. */
export function RpsTable() {
  const g = useGameState();
  const you = useViewSeat();
  const team = teamOf(you);
  const foe = rpsFoe(g);
  const { t, fmt } = useI18n();
  const first = g.rpsRound === 0;

  const revealed = g.phase === "rpsreveal";
  const mine = revealed ? g.rpsCards[team] : null;
  const theirs = revealed ? g.rpsCards[1 - team] : null;
  const cmp = mine && theirs ? rpsCompare(mine, theirs) : null;
  const tie = cmp === 0;
  const won = cmp !== null && cmp > 0;

  return (
    <div className="tablewrap">
      <div className="felt">
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
            {revealed ? (
              <>
                <span className="rpscard">
                  <b>{t("rps.you")}</b>
                  {mine && <Turned card={mine} />}
                </span>
                <span className="rpscard">
                  <b>{t("rps.opponent")}</b>
                  {theirs && <Turned card={theirs} />}
                </span>
              </>
            ) : (
              <span>
                {t("rps.opponent")}: <b>{t("table.cardCount", { n: fmt(g.hands[foe].length) })}</b>
              </span>
            )}
          </div>
          {revealed && (
            <div className="rpsoutcome">
              {tie ? t("rps.tied") : won ? t("rps.roundWon") : t("rps.roundLost")}
            </div>
          )}
          {/* The instructions read once, on the first round, and not again —
              the same gate RpsRevealPanel uses, for the same reason: a
              twelve-round match would otherwise repeat them eleven times. */}
          {first && (
            <>
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
            </>
          )}
        </div>
        <Panels />
      </div>
    </div>
  );
}

/* Both cards are placed face down and turn together, a beat later: the back is
   an overlay on the card and the turn is a CSS animation with a delay, so the
   reveal needs no timer of its own and no extra phase — resolveRps's own 1400ms
   tick is the window it fits inside. The slot is keyed by uid, so it mounts
   once per round and the animation plays exactly once, the same reason the
   trick's drop animation needs no bookkeeping. */
function Turned({ card }: { card: Card }) {
  return (
    <span className="rpsflip" key={card.uid}>
      <PlayingCard card={card} className="hcard" />
      <span className="rpsdown" />
    </span>
  );
}
