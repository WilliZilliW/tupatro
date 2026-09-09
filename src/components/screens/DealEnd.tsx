import { teamOf } from "../../game/constants";
import { dealPoints } from "../../game/points";
import { dealScores } from "../../game/race";
import { ownerSeat } from "../../game/rules";
import { tuppiInfo } from "../../game/scoring";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Rich } from "../Rich";
import { usePairLabels } from "../pairLabels";
import { MoveButton } from "../MoveButton";
import { ScoresButton } from "./ScoresModal";
import type { GameState } from "../../game/types";

/* Four screens behind one Screen kind, and a switch on the challenge's id
   rather than on the field's truth. A Tuppi-Rummikub deal has no target, no
   blind score to measure against and no rami/nolo line to explain, so the main
   branch's `why` — which reads g.mode, the team's tricks and tuppiInfo — would
   be a sentence about a rule the deal was not played under. A match deal is
   played under exactly those rules but has no blind either: what it measures
   itself against is the match target and the other pair.

   The two match modes share a layout and differ in one call: a race deal is
   worth chips × mult and a traditional one is worth tuppi's points, and no
   line here may fetch the wrong scale. */
export function DealEnd({ score }: { score: number }) {
  const { challenge } = useGameState();
  if (challenge === "rummikub") return <ChallengeDealEnd />;
  if (challenge === "race") return <MatchDealEnd deal={dealScoresOf} />;
  if (challenge === "tuppi") return <MatchDealEnd deal={dealPointsOf} />;
  return <MainDealEnd score={score} />;
}

/* Named functions rather than inline closures, so the two scales are two
   spellings a reader can tell apart at the call site. */
const dealScoresOf = (g: GameState): [number, number] => dealScores(g);
const dealPointsOf = (g: GameState): [number, number] => dealPoints(g);

function MainDealEnd({ score }: { score: number }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const team = teamOf(useViewSeat());
  const { t, fmt } = useI18n();
  /* The team is the viewer's side; the seat is the one whose wallet holds
     the jokers that pay for the multiplier. */
  const info = tuppiInfo(g, team, ownerSeat(g));
  const won = g.tricks[team];
  const lost = g.tricks[1 - team];

  const why = g.sooliBust
    ? t("why.sooliBust")
    : g.mode === "rami" && won < 7
      ? t("why.ramiShort", { won })
      : g.mode === "nolo" && won > 6
        ? t("why.noloBust", { won })
        : t("why.tricks", { us: won, them: lost, mult: info.mult });

  return (
    <Overlay>
      <h2>{t(score > 0 ? "dealEnd.scored" : "dealEnd.wasted")}</h2>
      <p className="dek">{why}</p>
      <div className="cashline">
        <span>{t("dealEnd.thisDeal")}</span>
        <b>{fmt(score)}</b>
      </div>
      <div className="cashline">
        <span>{t("dealEnd.blindScore")}</span>
        <b>
          {fmt(g.blindScore)} / {fmt(g.target)}
        </b>
      </div>
      <div className="cashline">
        <span>{t("dealEnd.dealsLeft")}</span>
        <b>{g.dealsLeft}</b>
      </div>
      <p className="dek" style={{ marginTop: 14 }}>
        <Rich text={t("dealEnd.missing", { n: fmt(g.target - g.blindScore) })} />
      </p>
      <div className="row">
        <MoveButton className="btn" onClick={() => dispatch({ type: "nextDeal" })}>
          {t("btn.nextDeal")}
        </MoveButton>
        <ScoresButton />
      </div>
    </Overlay>
  );
}

/* No target-remaining line, no dealsLeft line and no cash-out language: a
   match has no blind to fall short of and no fixed number of deals to run out
   of. What it owes the player is this deal for each pair, both running totals
   against the match target, and which deal this was. */
function MatchDealEnd({ deal: dealOf }: { deal: (g: GameState) => [number, number] }) {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();
  const [ours, theirs] = usePairLabels(team);
  /* raceBase and the trick counts both still hold the deal that just ended —
     startDeal is what clears them — so this is that deal's score and not the
     next one's. */
  const deal = dealOf(g);
  const total = t("matchDeal.total");

  const lines: Array<[string, string]> = [
    [`${ours} · ${t("raceDeal.thisDeal")}`, fmt(deal[team])],
    [`${theirs} · ${t("raceDeal.thisDeal")}`, fmt(deal[1 - team])],
    [`${ours} · ${total}`, `${fmt(g.raceScores[team])} / ${fmt(g.target)}`],
    [`${theirs} · ${total}`, `${fmt(g.raceScores[1 - team])} / ${fmt(g.target)}`],
    [t("chal.tricks"), `${g.tricks[team]}–${g.tricks[1 - team]}`],
  ];

  return (
    <Overlay>
      <h2>{t("raceDeal.title", { n: g.raceDeal })}</h2>
      {lines.map(([label, value]) => (
        <div className="cashline" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <div className="row">
        {/* nextDeal is a flow action, and the shared table sends none: the
            players click Continue on their own devices. The board button stays
            — opening a modal is the window's own. */}
        <MoveButton className="btn" onClick={() => dispatch({ type: "nextDeal" })}>
          {t("btn.nextDeal")}
        </MoveButton>
        <ScoresButton />
      </div>
    </Overlay>
  );
}

function ChallengeDealEnd() {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();
  /* dealsLeft is already decremented when this screen opens, so the deal just
     played is the difference. */
  const n = g.deals - g.dealsLeft;

  const lines: Array<[string, string]> = [
    [t("chalDeal.laid"), fmt(g.layScores[team])],
    [t("chalDeal.left"), fmt(g.layHands[team].length)],
    [t("chal.tricks"), `${g.tricks[team]}–${g.tricks[1 - team]}`],
    [t("chal.total"), fmt(g.blindScore)],
  ];

  return (
    <Overlay>
      <h2>{t("chalDeal.title", { n, total: g.deals })}</h2>
      {lines.map(([label, value]) => (
        <div className="cashline" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <div className="row">
        <MoveButton className="btn" onClick={() => dispatch({ type: "nextDeal" })}>
          {t("btn.nextDeal")}
        </MoveButton>
        <ScoresButton />
      </div>
    </Overlay>
  );
}
