import { useState } from "react";
import { pipTotal, validateLay } from "../../game/laydown";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";
import type { Card } from "../../game/types";

/* The laydown workspace. Panels.tsx mounts this with key={g.layNo}, so a new
   turn remounts it and the workspace starts from the table as it stands.

   Click to select, click a row to move there; Reset is the only undo and
   there is no drag. Nothing is dispatched until Lay, and the reducer re-runs
   the same validateLay — the panel is a convenience, not the rule.

   The opponents play the same rules with a simpler search: they extend and
   lay, and never split or merge a combination. That is a weaker opponent, not
   a different rule set. */
export function LaydownPanel() {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();

  const hand = g.layHands[0];
  /* Every card the turn can touch, by uid: the table as it stands plus the
     hand. Identity is uid everywhere, so the workspace is rows of uids. */
  const byUid = new Map<string, Card>();
  for (const row of g.table) for (const c of row) byUid.set(c.uid, c);
  for (const c of hand) byUid.set(c.uid, c);

  const [rows, setRows] = useState<string[][]>(() => g.table.map((r) => r.map((c) => c.uid)));
  const [sel, setSel] = useState<string | null>(null);

  const placed = new Set(rows.flat());
  const left = hand.filter((c) => !placed.has(c.uid));
  const cardsOf = (row: string[]) => row.map((u) => byUid.get(u)).filter((c): c is Card => !!c);

  /* A row that empties on a move disappears rather than lingering as a row
     validateLay would reject. */
  const moveTo = (target: number) => {
    if (sel === null) return;
    const next = rows.map((r) => r.filter((u) => u !== sel));
    if (target < next.length) next[target] = [...next[target], sel];
    else next.push([sel]);
    setRows(next.filter((r) => r.length > 0));
    setSel(null);
  };

  const proposal = rows.filter((r) => r.length > 0);
  const check = validateLay(g.table, hand, proposal);
  /* The panel stays up through the opponents' turn — the table is what the
     player is watching — but nothing on it acts then. */
  const mine = g.layTurn === 0;

  const reset = () => {
    setRows(g.table.map((r) => r.map((c) => c.uid)));
    setSel(null);
  };

  return (
    <div className="laydown">
      {/* The 60 seconds are drawn, not counted: the bar is a CSS animation and
          the only clock is the one in useGameLoop. */}
      {mine && <div className="laytimer" />}
      <div className="layhead">
        <h3>{t("lay.title")}</h3>
        <span className="laypts">
          {t("lay.points", { us: fmt(g.layScores[0]), them: fmt(g.layScores[1]) })}
        </span>
      </div>

      <h4>{t("lay.table")}</h4>
      <div className="layrows">
        {rows.length === 0 && <p className="dek">{t("lay.tableEmpty")}</p>}
        {rows.map((row, i) => (
          <div className="layrow" key={`row${i}`} onClick={() => moveTo(i)}>
            {cardsOf(row).map((c) => (
              <PlayingCard
                key={c.uid}
                card={c}
                className={cx("laycard", sel === c.uid && "sel")}
                /* The row is the drop target, so a click on a card inside it
                   must not also count as a click on the row. */
                onClick={(e) => {
                  e.stopPropagation();
                  setSel(c.uid);
                }}
              />
            ))}
            <span className="laysum">{fmt(pipTotal(cardsOf(row)))}</span>
          </div>
        ))}
        <button
          className="layrow newrow"
          type="button"
          disabled={sel === null}
          onClick={() => moveTo(rows.length)}
        >
          {t("lay.newRow")}
        </button>
      </div>

      <h4>{t("lay.hand", { n: left.length })}</h4>
      <div className="layhand">
        {left.length === 0 && <p className="dek">{t("lay.handEmpty")}</p>}
        {left.map((c) => (
          <PlayingCard
            key={c.uid}
            card={c}
            className={cx("laycard", sel === c.uid && "sel")}
            onClick={() => setSel(c.uid)}
          />
        ))}
      </div>

      <p className="dek">{t("lay.dek")}</p>
      {/* Before the footer, never after it: .row is a sticky, opaque footer
          and anything drawn after it scrolls underneath. */}
      {!mine && <p className="dek">{t("lay.wait")}</p>}

      <div className="row layfoot">
        <button
          className={cx("btn", (!mine || !check.ok) && "off")}
          disabled={!mine || !check.ok}
          onClick={() => dispatch({ type: "layCards", combos: proposal })}
        >
          {t("btn.lay")}
        </button>
        <button className="btn ghost" disabled={!mine} onClick={reset}>
          {t("btn.resetLay")}
        </button>
        <button
          className="btn ghost"
          disabled={!mine}
          onClick={() => dispatch({ type: "passLaydown" })}
        >
          {t("btn.pass")}
        </button>
      </div>
    </div>
  );
}
