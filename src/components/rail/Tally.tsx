import { teamOf } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import { usePairLabels } from "../pairLabels";

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
  const { tricks } = useGameState();
  const team = teamOf(useViewSeat());
  const { t } = useI18n();
  const spectating = useSpectating();
  const pairs = usePairLabels(team);

  /* "Me" and "He" are written from a chair, and this is the main game's only
     plate that names a side — a hosted main-game run is reachable, so the
     shared table draws it. There it names both pairs by their characters
     instead, the same answer `MatchPlate` gives. Off the table the chair's own
     words stay: `usePairLabels`' from-a-chair half is the race's `chal.us` /
     `chal.them`, which is not what this plate has ever said. */
  const [ours, theirs] = spectating ? pairs : [t("rail.us"), t("rail.them")];

  const rows: Array<{ label: string; n: number; them: boolean }> = [
    { label: ours, n: tricks[team], them: false },
    { label: theirs, n: tricks[1 - team], them: true },
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
