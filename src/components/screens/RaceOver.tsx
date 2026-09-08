import { useState } from "react";
import { teamOf } from "../../game/constants";
import { dealScores } from "../../game/race";
import { addRaceScore, raceRowFor, type RaceRow } from "../../game/scores";
import { readRaceScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Rich } from "../Rich";
import type { Screen } from "../../game/types";

/* The match is over, so this screen draws the board — the same named deviation
   from "markup only" that GameOver, Victory and ChallengeOver make, through
   game/storage.ts and nothing else.

   The row is merged in here as well as written by the provider, because React
   runs a child's effect before its parent's: on the commit that first shows
   this screen the board on disk does not have the match yet. addRaceScore
   collapses a row equal on everything but the timestamp, so it cannot
   duplicate. */
export function RaceOver({ screen }: { screen: Extract<Screen, { kind: "raceover" }> }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const team = teamOf(useViewSeat());
  const { t, fmt } = useI18n();
  const [at] = useState(() => Date.now());
  const rows = addRaceScore(readRaceScores(), raceRowFor(g, at));
  /* raceBase still holds the deal that ended the match — startDeal is what
     clears it — so the deciding deal can be shown rather than hidden behind
     the totals. */
  const last = dealScores(g);
  /* Play again keeps the table it was played at: the count is not saved
     anywhere (a race is never saved at all), so it is read back out of the
     seats. */
  const humans = g.seats.filter((k) => k === "human").length as 1 | 2 | 3 | 4;

  const lines: Array<[string, string]> = [
    [`${t("chal.us")} · ${t("raceDeal.total")}`, `${fmt(screen.scores[team])} / ${fmt(g.target)}`],
    [
      `${t("chal.them")} · ${t("raceDeal.total")}`,
      `${fmt(screen.scores[1 - team])} / ${fmt(g.target)}`,
    ],
    [`${t("chal.us")} · ${t("raceOver.lastDeal")}`, fmt(last[team])],
    [`${t("chal.them")} · ${t("raceOver.lastDeal")}`, fmt(last[1 - team])],
    [t("raceOver.deals"), fmt(screen.deals)],
    [t("seed.label"), g.seed],
  ];

  return (
    <Overlay>
      <h2>{t("raceOver.title")}</h2>
      <p className="dek">
        <Rich text={t(screen.winner === team ? "raceOver.won" : "raceOver.lost")} />
      </p>
      {lines.map(([label, value]) => (
        <div className="cashline" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <RaceBoard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        <button
          className="btn"
          onClick={() => dispatch({ type: "startChallenge", id: "race", humans })}
        >
          {t("btn.playAgain")}
        </button>
        <button
          className="btn ghost"
          onClick={() => dispatch({ type: "startChallenge", id: "race", seed: g.seed, humans })}
        >
          {t("btn.replaySeed")}
        </button>
        {/* Back to the menu, which is where the race is left: the Leave button
            there is the only site that dispatches leaveChallenge. */}
        <button className="btn ghost" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
          {t("btn.toMenu")}
        </button>
      </div>
    </Overlay>
  );
}

/* Rows in, markup out, like Scoreboard and ChallengeBoard — and a third
   component rather than a mode of either, because the row shape is a third
   one: a race has no ante and no blind, and unlike a challenge it can be lost
   and is sorted on the fewest deals.

   It borrows the main board's six-column `.scoretable` grid rather than
   growing a stylesheet of its own, so the deal count sits in the narrow
   numeric slot the ante uses and the blind's wider slot is left empty — the
   same empty `<span />` the main board's head row already ends with. */
function RaceBoard({ rows }: { rows: RaceRow[] }) {
  const { t, fmt } = useI18n();

  return (
    <div className="scoreboard">
      <h3>{t("raceScore.title")}</h3>
      {rows.length === 0 ? (
        <p className="dek">{t("score.empty")}</p>
      ) : (
        <div className="scoretable">
          <div className="scorehead">
            <span>{t("score.rank")}</span>
            <span>{t("seed.label")}</span>
            <span>{t("raceScore.deals")}</span>
            <span />
            <span>{t("score.points")}</span>
            <span>{t("raceScore.result")}</span>
          </div>
          {rows.map((row, i) => (
            <div className="scorerow" key={`${row.seed}-${row.at}-${i}`}>
              <span className="srank">{i + 1}</span>
              <span className="sseed">{row.seed}</span>
              <span className="sante">{fmt(row.deals)}</span>
              <span />
              <span className="spts">{fmt(row.score)}</span>
              <span className={row.won ? "sres won" : "sres"}>
                {t(row.won ? "score.won" : "score.lost")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
