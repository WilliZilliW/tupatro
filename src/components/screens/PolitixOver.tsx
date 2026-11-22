import { Fragment, useState, type CSSProperties } from "react";
import { PX_GROUPS, pxDecider, pxPartiesInPlay } from "../../game/politix";
import { addPolitixScore, politixRowFor, type PolitixRow } from "../../game/scores";
import { readPolitixScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet, useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import type { PxPartyId, Screen, Seat } from "../../game/types";

/* The screen reads left, centre, right; PX_PARTIES keeps its own order. */
const RESULT_ORDER: PxPartyId[] = ["left", "centre", "right"];
const RESULT_KEY = { won: "pxOver.won", lost: "pxOver.lost", drawn: "pxOver.drawn" } as const;
const BOARD_KEY = { won: "score.won", lost: "score.lost", drawn: "score.drawn" } as const;

/* The game is over, so this screen draws the board — the same named deviation
   from "markup only" the other result screens make, through game/storage.ts.
   The row is merged in here as well as filed by the provider, because a child's
   effect runs before its parent's; addPolitixScore collapses a repeat. */
export function PolitixOver({ screen }: { screen: Extract<Screen, { kind: "politixover" }> }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const spectating = useSpectating();
  const { t, fmt, seatName } = useI18n();
  const view = useViewSeat();
  const own = screen.parties[view];
  const inPlay = pxPartiesInPlay({ party: screen.parties });
  const players = screen.parties.filter((p) => p !== null).length as 2 | 3 | 4;
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
  /* Merged in only when the provider is going to file it: GameContext files
     nothing while a session is live, and politixRowFor reads ownerSeat rather
     than this window's own seat, so a merged row would put the owner's result
     on another player's board. */
  const rows = net.live ? disk : addPolitixScore(disk, politixRowFor(g, at));
  /* A display sits in no chair, so its headline names the result instead of
     reading the default seat 0. */
  const wonBy = screen.winners.map((id) => t(`px.party.${id}`));
  const headline = !spectating
    ? t(RESULT_KEY[resultKey])
    : wonBy.length > 1
      ? t("pxOver.drawnBy", { parties: wonBy.join(", ") })
      : t("pxOver.wonBy", { party: wonBy[0] ?? "" });

  const cols = RESULT_ORDER.filter((id) => inPlay.includes(id));
  const ring = pxDecider(screen.counts, screen.turns, inPlay, screen.winners);

  return (
    <Overlay>
      <h2>{t("pxOver.title")}</h2>
      <div className="pxwinner">
        <p className="dek">{headline}</p>
        {cols.map((id) => (
          <p className="dek" key={id}>
            {t("pxOver.members", {
              party: t(`px.party.${id}`),
              names: ([0, 1, 2, 3] as Seat[])
                .filter((seat) => screen.parties[seat] === id)
                .map((seat) => seatName(seat, spectating ? null : view))
                .join(", "),
            })}
          </p>
        ))}
      </div>
      <div className="pxresult" style={{ "--cols": cols.length } as CSSProperties}>
        <span />
        {cols.map((id) => (
          <b className="pxcolhead" key={id}>
            {t(`px.party.${id}`)}
          </b>
        ))}
        {PX_GROUPS.map((gr, i) => (
          <Fragment key={gr}>
            <span>{t(`px.group.${gr}`)}</span>
            {cols.map((id) => (
              <b
                key={id}
                data-party={id}
                data-group={gr}
                className={ring[id] === i ? "pxwin" : undefined}
              >
                {fmt(screen.counts[id][i])}
              </b>
            ))}
          </Fragment>
        ))}
        <span>{t("pxOver.turns")}</span>
        {cols.map((id) => (
          <b
            key={id}
            data-party={id}
            data-row="turns"
            className={ring[id] === "turns" ? "pxwin" : undefined}
          >
            {fmt(screen.turns[id])}
          </b>
        ))}
      </div>
      {Object.keys(ring).length > 0 && <p className="dek">{t("pxOver.circled")}</p>}
      <div className="cashline">
        <span>{t("seed.label")}</span>
        <b>{g.seed}</b>
      </div>
      <PolitixBoard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        <MoveButton
          className="btn"
          onClick={() =>
            dispatch({ type: "startChallenge", id: "politix", seats: g.seats, players })
          }
        >
          {t("btn.playAgain")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() =>
            dispatch({
              type: "startChallenge",
              id: "politix",
              seed: g.seed,
              seats: g.seats,
              players,
            })
          }
        >
          {t("btn.replaySeed")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() => {
            if (net.live) net.hangUp();
            dispatch({ type: "leaveChallenge" });
          }}
        >
          {t("btn.backToRun")}
        </MoveButton>
      </div>
      {net.live && !spectating && <p className="dek">{t("net.leaveHangsUp")}</p>}
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
