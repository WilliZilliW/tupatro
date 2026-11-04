import { useState } from "react";
import { PX_PARTIES } from "../../game/content";
import { PX_GROUPS } from "../../game/politix";
import { addPolitixScore, politixRowFor, type PolitixRow } from "../../game/scores";
import { readPolitixScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import type { Screen } from "../../game/types";

const RESULT_KEY = { won: "pxOver.won", lost: "pxOver.lost", drawn: "pxOver.drawn" } as const;
const BOARD_KEY = { won: "score.won", lost: "score.lost", drawn: "score.drawn" } as const;

/* The game is over, so this screen draws the board — the same named deviation
   from "markup only" the other result screens make, through game/storage.ts.
   The row is merged in here as well as filed by the provider, because a child's
   effect runs before its parent's; addPolitixScore collapses a repeat. */
export function PolitixOver({ screen }: { screen: Extract<Screen, { kind: "politixover" }> }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();
  const own = screen.parties[useViewSeat()];
  const [at] = useState(() => Date.now());
  /* Won when the viewer's party is the only winner, drawn when it is one of
     several tied, lost otherwise. */
  const resultKey =
    own === null || !screen.winners.includes(own)
      ? "lost"
      : screen.winners.length > 1
        ? "drawn"
        : "won";
  const disk = readPolitixScores();
  /* Single player only: no session can reach this screen, so the row is always
     the one the provider is about to file, and there is no hang-up to make. */
  const rows = addPolitixScore(disk, politixRowFor(g, at));

  return (
    <Overlay>
      <h2>{t("pxOver.title")}</h2>
      <p className="dek">{t(RESULT_KEY[resultKey])}</p>
      <div className="cashline">
        <span />
        <b>
          {t("px.scoreHead", {
            a: t(`px.party.${PX_PARTIES[0]}`),
            b: t(`px.party.${PX_PARTIES[1]}`),
            c: t(`px.party.${PX_PARTIES[2]}`),
          })}
        </b>
      </div>
      {PX_GROUPS.map((gr, i) => (
        <div className="cashline" key={gr}>
          <span>{t(`px.group.${gr}`)}</span>
          <b>
            {fmt(screen.counts[PX_PARTIES[0]][i])} – {fmt(screen.counts[PX_PARTIES[1]][i])} –{" "}
            {fmt(screen.counts[PX_PARTIES[2]][i])}
          </b>
        </div>
      ))}
      {PX_PARTIES.map((id) => (
        <div className="cashline" key={id}>
          <span>
            {t(`px.party.${id}`)} · {t("pxOver.turns")}
          </span>
          <b>{fmt(screen.turns[id])}</b>
        </div>
      ))}
      <div className="cashline">
        <span>{t("seed.label")}</span>
        <b>{g.seed}</b>
      </div>
      <PolitixBoard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        <MoveButton
          className="btn"
          onClick={() => dispatch({ type: "startChallenge", id: "politix", seats: g.seats })}
        >
          {t("btn.playAgain")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() =>
            dispatch({ type: "startChallenge", id: "politix", seed: g.seed, seats: g.seats })
          }
        >
          {t("btn.replaySeed")}
        </MoveButton>
        <MoveButton className="btn ghost" onClick={() => dispatch({ type: "leaveChallenge" })}>
          {t("btn.backToRun")}
        </MoveButton>
      </div>
    </Overlay>
  );
}

function PolitixBoard({ rows }: { rows: PolitixRow[] }) {
  const { t, fmt } = useI18n();
  return (
    <div className="scoreboard">
      <h3>{t("pxScore.title")}</h3>
      {rows.length === 0 ? (
        <p className="dek">{t("score.empty")}</p>
      ) : (
        <div className="scoretable pxtable">
          <div className="scorehead">
            <span>{t("score.rank")}</span>
            <span>{t("seed.label")}</span>
            <span>{t("pxOver.turns")}</span>
            <span>{t("raceScore.result")}</span>
          </div>
          {rows.map((row, i) => (
            <div className="scorerow" key={`${row.seed}-${row.at}-${i}`}>
              <span className="srank">{i + 1}</span>
              <span className="sseed">{row.seed}</span>
              <span className="sante">{fmt(row.turns)}</span>
              <span className={row.result === "won" ? "sres won" : "sres"}>
                {t(BOARD_KEY[row.result])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
