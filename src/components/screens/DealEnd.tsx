import { teamOf } from "../../game/constants";
import { dealScores } from "../../game/race";
import { ownerSeat } from "../../game/rules";
import { tuppiInfo } from "../../game/scoring";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Rich } from "../Rich";
import { ScoresButton } from "./ScoresModal";

/* Three screens behind one Screen kind, and a switch on the challenge's id
   rather than on the field's truth. A Tuppi-Rummikub deal has no target, no
   blind score to measure against and no rami/nolo line to explain, so the main
   branch's `why` — which reads g.mode, the team's tricks and tuppiInfo — would
   be a sentence about a rule the deal was not played under. A race deal is
   played under exactly those rules but has no blind either: what it measures
   itself against is the match target and the other pair. */
export function DealEnd({ score }: { score: number }) {
  const { challenge } = useGameState();
  if (challenge === "rummikub") return <ChallengeDealEnd />;
  if (challenge === "race") return <RaceDealEnd />;
  return <MainDealEnd score={score} />;
}

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
        <button className="btn" onClick={() => dispatch({ type: "nextDeal" })}>
          {t("btn.nextDeal")}
        </button>
        <ScoresButton />
      </div>
    </Overlay>
  );
}

/* No target-remaining line, no dealsLeft line and no cash-out language: a race
   has no blind to fall short of and no fixed number of deals to run out of.
   What it owes the player is this deal for each pair, both running totals
   against the match target, and which deal this was. */
function RaceDealEnd() {
  const g = useGameState();
  const team = teamOf(useViewSeat());
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();
  /* raceBase still holds the deal that just ended — startDeal is what clears
     it — so this is that deal's score and not the next one's. */
  const deal = dealScores(g);

  const lines: Array<[string, string]> = [
    [`${t("chal.us")} · ${t("raceDeal.thisDeal")}`, fmt(deal[team])],
    [`${t("chal.them")} · ${t("raceDeal.thisDeal")}`, fmt(deal[1 - team])],
    [`${t("chal.us")} · ${t("raceDeal.total")}`, `${fmt(g.raceScores[team])} / ${fmt(g.target)}`],
    [
      `${t("chal.them")} · ${t("raceDeal.total")}`,
      `${fmt(g.raceScores[1 - team])} / ${fmt(g.target)}`,
    ],
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
        <button className="btn" onClick={() => dispatch({ type: "nextDeal" })}>
          {t("btn.nextDeal")}
        </button>
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
        <button className="btn" onClick={() => dispatch({ type: "nextDeal" })}>
          {t("btn.nextDeal")}
        </button>
        <ScoresButton />
      </div>
    </Overlay>
  );
}
