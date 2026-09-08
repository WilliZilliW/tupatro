import { SEATS } from "../../game/constants";
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
  dropped: "net.dropped",
};

export function NetBanner() {
  const net = useNet();
  const { t } = useI18n();
  if (!net.live) return null;

  const bad = net.status !== null && net.status !== "live";
  const seat = net.seat;
  return (
    <div className={cx("netbanner", bad && "bad")} role="status">
      <span className="who">
        {net.role === "host" ? t("net.hosting") : t("net.joined")}
        {/* The character, not "You": the banner's job is to say which chair
            this window holds, and every window would say "You". */}
        {seat !== null && ` · ${SEATS[seat].name}`}
      </span>
      {net.status && <span className="what">{t(SAYS[net.status])}</span>}
    </div>
  );
}
