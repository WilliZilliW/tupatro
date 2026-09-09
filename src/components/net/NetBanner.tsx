import { SEATS } from "../../game/constants";
import { useDispatch } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import type { LocaleKey } from "../../i18n";
import type { SessionStatus } from "../../net/session";

/* Drawn outside Screens, because .overlay is fixed and inset:0 — a warning
   underneath one would be a warning nobody sees, and "the peers are no longer
   in step" is exactly the thing a player must be told while a full-screen
   result is up. */
const SAYS: Record<SessionStatus, LocaleKey> = {
  live: "net.live",
  desync: "net.desync",
  version: "net.version",
  late: "net.late",
  nochair: "net.nochair",
  dropped: "net.dropped",
};

const ROLE: Record<"host" | "guest" | "table", LocaleKey> = {
  host: "net.hosting",
  guest: "net.joined",
  table: "net.table",
};

export function NetBanner() {
  const net = useNet();
  const dispatch = useDispatch();
  const { t } = useI18n();
  if (!net.live) return null;

  const bad = net.status !== null && net.status !== "live";
  const seat = net.seat;
  const table = net.role === "table";
  return (
    <div className={cx("netbanner", bad && "bad")} role="status">
      <span className="who">
        {t(ROLE[net.role === "host" ? "host" : table ? "table" : "guest"])}
        {/* The character, not "You": the banner's job is to say which chair
            this window holds, and every window would say "You". The shared
            table holds none, so it says only what it is. */}
        {seat !== null && ` · ${SEATS[seat].name}`}
      </span>
      {net.status && <span className="what">{t(SAYS[net.status])}</span>}
      {/* The shared table's rail has no New game button and its screens no
          Continue, so this is the one way off the table without a reload. */}
      {table && (
        <button
          className="tinybtn"
          onClick={() => {
            net.hangUp();
            dispatch({ type: "showMenu", view: "start" });
          }}
        >
          {t("btn.hangUp")}
        </button>
      )}
    </div>
  );
}
