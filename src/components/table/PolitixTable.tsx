import { PX_GROUPS } from "../../game/politix";
import { PX_SYMBOL_BONUS } from "../../game/constants";
import {
  PX_EVENTS,
  PX_GROUP_NEED,
  PX_PARTIES,
  PX_PARTY_SYMBOL,
  PX_POLITICIANS,
  PX_TACTICS_LIST,
} from "../../game/content";
import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { PolitixIcon, PolitixMiniFace, PxChip } from "../PolitixCard";
import { cx } from "../cx";
import type { Seat } from "../../game/types";

/* Politix's felt: the table, never the controls (those are the hand's own
   bar). Everything public is drawn — voter cards, the event, each seat's
   politician, modifiers and burnout, both parties' counts, the piles and the
   last take — and every hand as a count only, since the sheet forbids showing
   them. The last take is data in PolitixState and is worded here, in the
   viewer's language; a toast would be worded once, for one window. */
export function PolitixTable() {
  return (
    <div className="tablewrap">
      <PolitixBoard />
    </div>
  );
}

/* The felt itself, shared with PrivateTable, which draws it inside .privstage
   on a chair-holder's window while a display shows the board. */
export function PolitixBoard() {
  const g = useGameState();
  const anchor = useViewSeat();
  const spectating = useSpectating();
  const you: Seat | null = spectating ? null : anchor;
  const { t, fmt, nameOf, descOf, seatName } = useI18n();
  const px = g.politix;
  if (!px) return <div className="felt pxfelt" />;

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
  /* The sitting-out seat has no party and gets no area at all. */
  const seats = ([0, 1, 2, 3] as Seat[])
    .map((s) => ((anchor + s) % 4) as Seat)
    .filter((s) => px.party[s] !== null);
  const names = Object.fromEntries(PX_PARTIES.map((id) => [id, t(`px.party.${id}`)]));

  return (
    <div className="felt pxfelt">
      <div className="pxhead">
        <b>{t("px.turnOf", { who: seatName(px.turn, you) })}</b>
        {ev ? (
          <span className={cx("pxevcard", `pxt-${ev.tactic}`)}>
            <PolitixIcon name={ev.tactic} />
            <span>
              <b>{nameOf(ev)}</b>
              <small>{descOf(ev)}</small>
            </span>
          </span>
        ) : (
          <span className="pxevcard empty">{t("px.eventNone")}</span>
        )}
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
          <div
            key={gr}
            className={cx(
              "pxvcard",
              `pxg-${gr}`,
              px.table.filter((v) => v.group === gr).length > 1 && "stack",
            )}
          >
            <span className="pxcount">{fmt(px.table.filter((v) => v.group === gr).length)}</span>
            <PolitixIcon name={gr} />
            <b>{t(`px.group.${gr}`)}</b>
            <span
              className="pxneeds"
              role="img"
              aria-label={t("px.needs", {
                a: fmt(PX_GROUP_NEED[gr].argue),
                e: fmt(PX_GROUP_NEED[gr].evade),
                c: fmt(PX_GROUP_NEED[gr].charm),
                g: fmt(PX_GROUP_NEED[gr].growl),
              })}
            >
              {PX_TACTICS_LIST.map((tc) => (
                <PxChip key={tc} tactic={tc} text={fmt(PX_GROUP_NEED[gr][tc])} />
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="pxseats">
        {seats.map((s) => {
          const pol = PX_POLITICIANS.find((x) => x.id === px.politicians[s]);
          const party = px.party[s];
          const sym = party ? PX_PARTY_SYMBOL[party] : null;
          const burnCard = px.burn[s];
          return (
            <div key={s} className={cx("pxseat", px.turn === s && "turn")}>
              <b>{seatName(s, you)}</b>
              {party && sym && (
                <small className="pxparty">
                  <PolitixIcon name={sym.symbol} />{" "}
                  {t("px.partyInfo", {
                    party: names[party],
                    symbol: t(`px.symbol.${sym.symbol}`),
                    group: t(`px.group.${sym.group}`),
                    bonus: fmt(PX_SYMBOL_BONUS),
                  })}
                </small>
              )}
              {pol && sym && (
                <span className="pxpol">
                  <span className="pxpolname">
                    <PolitixIcon name={sym.symbol} />
                    <span>{nameOf(pol)}</span>
                  </span>
                  <span
                    className="pxskills"
                    role="img"
                    aria-label={t("px.skills", {
                      a: fmt(pol.skills[0]),
                      e: fmt(pol.skills[1]),
                      c: fmt(pol.skills[2]),
                      g: fmt(pol.skills[3]),
                    })}
                  >
                    {PX_TACTICS_LIST.map((tc, i) => (
                      <PxChip key={tc} tactic={tc} text={`+${fmt(pol.skills[i])}`} />
                    ))}
                  </span>
                </span>
              )}
              <small>{t("px.hand", { n: fmt(px.hands[s].length) })}</small>
              {burnCard && (
                <span className="pxburned" title={t("px.burned")}>
                  <PolitixMiniFace card={burnCard} />
                </span>
              )}
              {px.scandals[s].length > 0 && (
                <span className="pxscandals">
                  {px.scandals[s].map((c) => (
                    <PolitixMiniFace key={c.uid} card={c} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="pxscore">
        <span>
          <b>
            {t("px.scoreHead", {
              a: names[PX_PARTIES[0]],
              b: names[PX_PARTIES[1]],
              c: names[PX_PARTIES[2]],
            })}
          </b>
        </span>
        {PX_GROUPS.map((gr, i) => (
          <span key={gr}>
            {t("px.score", {
              group: t(`px.group.${gr}`),
              a: fmt(px.collected[PX_PARTIES[0]][i]),
              b: fmt(px.collected[PX_PARTIES[1]][i]),
              c: fmt(px.collected[PX_PARTIES[2]][i]),
            })}
          </span>
        ))}
      </div>
      <div className="pxlast">{lastText}</div>
    </div>
  );
}
