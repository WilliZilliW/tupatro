import { PX_GROUPS } from "../../game/politix";
import { PX_EVENTS, PX_GROUP_NEED, PX_POLITICIANS } from "../../game/content";
import { teamOf } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { PolitixIcon } from "../PolitixCard";
import { cx } from "../cx";
import type { Seat } from "../../game/types";

/* Politix's felt: the table, never the controls (those are the hand's own
   bar). Everything public is drawn — voter cards, the event, each seat's
   politician, modifiers and burnout, both parties' counts, the piles and the
   last take — and every hand as a count only, since the sheet forbids showing
   them. The last take is data in PolitixState and is worded here, in the
   viewer's language; a toast would be worded once, for one window. */
export function PolitixTable() {
  const g = useGameState();
  const anchor = useViewSeat();
  const spectating = useSpectating();
  const you: Seat | null = spectating ? null : anchor;
  const { t, fmt, nameOf, descOf, seatName } = useI18n();
  const px = g.politix;
  if (!px)
    return (
      <div className="tablewrap">
        <div className="felt pxfelt" />
      </div>
    );

  const team = teamOf(anchor);
  const ev = PX_EVENTS.find((e) => e.id === px.event) ?? null;
  const onTable = PX_GROUPS.filter((gr) => px.table.some((v) => v.group === gr));
  const last = px.last;
  const lastText = !last
    ? t("px.last.none")
    : last.what === "draw"
      ? t("px.last.draw", { who: seatName(last.p, you), n: fmt(last.n) })
      : last.what === "rest"
        ? t("px.last.rest", { who: seatName(last.p, you) })
        : last.what === "take"
          ? t("px.last.take", {
              who: seatName(last.p, you),
              n: fmt(last.n),
              group: t(`px.group.${last.group ?? "farmers"}`),
            })
          : t("px.last.play", { who: seatName(last.p, you) });
  const seats = ([0, 1, 2, 3] as Seat[]).map((s) => ((anchor + s) % 4) as Seat);

  return (
    <div className="tablewrap">
      <div className="felt pxfelt">
        <div className="pxhead">
          <b>{t("px.turnOf", { who: seatName(px.turn, you) })}</b>
          <span>
            {ev ? t("px.eventNow", { name: nameOf(ev), text: descOf(ev) }) : t("px.eventNone")}
          </span>
          <span>
            {t("px.piles", {
              draw: fmt(px.draw.length),
              discard: fmt(px.discard.length),
              voters: fmt(px.voterDeck.length),
            })}
          </span>
        </div>

        <div className="pxgroups">
          {onTable.map((gr) => (
            <div key={gr} className={cx("pxgroup", `pxg-${gr}`)}>
              <b>
                {t(`px.group.${gr}`)} × {fmt(px.table.filter((v) => v.group === gr).length)}
              </b>
              <small>
                {t("px.needs", {
                  a: fmt(PX_GROUP_NEED[gr].argue),
                  e: fmt(PX_GROUP_NEED[gr].evade),
                  c: fmt(PX_GROUP_NEED[gr].charm),
                  g: fmt(PX_GROUP_NEED[gr].growl),
                })}
              </small>
            </div>
          ))}
        </div>

        <div className="pxseats">
          {seats.map((s) => {
            const pol = PX_POLITICIANS.find((x) => x.id === px.politicians[s]);
            return (
              <div key={s} className={cx("pxseat", px.turn === s && "turn")}>
                <b>{seatName(s, you)}</b>
                {pol && (
                  <>
                    <span>{nameOf(pol)}</span>
                    <small>
                      {t("px.skills", {
                        a: fmt(pol.skills[0]),
                        e: fmt(pol.skills[1]),
                        c: fmt(pol.skills[2]),
                        g: fmt(pol.skills[3]),
                      })}
                    </small>
                  </>
                )}
                <small>{t("px.hand", { n: fmt(px.hands[s].length) })}</small>
                {px.burn[s] && (
                  <small className="pxburned">
                    <PolitixIcon name="burnout" /> {t("px.burned")}
                  </small>
                )}
                {px.mods[s].length > 0 && (
                  <small>
                    {t("px.mods", {
                      list: px.mods[s]
                        .map((c) =>
                          t("px.mod", {
                            delta: c.delta > 0 ? "+1" : "−1",
                            group: t(`px.group.${c.group ?? "farmers"}`),
                          }),
                        )
                        .join(", "),
                    })}
                  </small>
                )}
              </div>
            );
          })}
        </div>

        <div className="pxscore">
          {PX_GROUPS.map((gr, i) => (
            <span key={gr}>
              {t("px.score", {
                group: t(`px.group.${gr}`),
                us: fmt(px.collected[team][i]),
                them: fmt(px.collected[1 - team][i]),
              })}
            </span>
          ))}
        </div>
        <div className="pxlast">{lastText}</div>
      </div>
    </div>
  );
}
