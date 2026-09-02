import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";

/* Tricks in tally marks: the fifth stroke crosses the other four. */
function Marks({ n }: { n: number }) {
  if (!n) return <b style={{ opacity: 0.2 }}>–</b>;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <b key={i} className={cx((i + 1) % 5 === 0 && "five")}>
          |
        </b>
      ))}
    </>
  );
}

export function Tally() {
  const { usTricks, themTricks } = useGameState();
  const { t } = useI18n();

  const rows: Array<{ label: string; n: number; them: boolean }> = [
    { label: t("rail.us"), n: usTricks, them: false },
    { label: t("rail.them"), n: themTricks, them: true },
  ];

  return (
    <div className="plate">
      <div className="tallies">
        {rows.map((r) => (
          <div key={r.label} className={cx("tally", r.them && "them")}>
            <div className="lbl">{r.label}</div>
            <div className="tallymark">
              <Marks n={r.n} />
            </div>
            <div className="tallynum">
              {r.n}
              {t("rail.tricksSuffix")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
