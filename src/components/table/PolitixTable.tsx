import { PX_GROUPS, pxPartiesInPlay } from "../../game/politix";
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
import {
  PolitixBonusFace,
  PolitixCardFace,
  PolitixIcon,
  PxChip,
  type PxIconName,
} from "../PolitixCard";
import { pxPileFaces } from "./pxPile";
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
  const { t, fmt, nameOf, descOf, seatName, locale } = useI18n();
  const px = g.politix;
  if (!px) return <div className="felt pxfelt" />;

  const ev = PX_EVENTS.find((e) => e.id === px.event) ?? null;
  const onTable = PX_GROUPS.filter((gr) => px.table.some((v) => v.group === gr));
  const last = px.last;
  const lastText = !last
    ? t("px.last.none")
    : last.what === "pass"
      ? t("px.last.pass", { who: seatName(last.p, you) })
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
  const inPlay = pxPartiesInPlay(px);

  const lastIcon: PxIconName | null = !last
    ? null
    : last.what === "take"
      ? (last.group ?? "farmers")
      : last.what === "play"
        ? "scandal"
        : last.what;
  const css = (v: Record<string, string | number>) => v as React.CSSProperties;

  return (
    <div className="felt pxfelt" lang={locale} style={css({ "--px-seats": seats.length })}>
      <div className="pxmain">
        <div className="pxhead">
          <b className="pxturn">{t("px.turnOf", { who: seatName(px.turn, you) })}</b>
          {ev ? (
            <span className={cx("pxevcard", `pxt-${ev.tactic}`)}>
              <span className="pxmedal">
                <PolitixIcon name={ev.tactic} />
              </span>
              <span className="pxevtext">
                <b>{nameOf(ev)}</b>
                <small>{descOf(ev)}</small>
              </span>
            </span>
          ) : (
            <span className="pxevcard empty">{t("px.eventNone")}</span>
          )}
          <span
            className="pxstacks"
            role="img"
            aria-label={t("px.piles", {
              draw: fmt(px.draw.length),
              discard: fmt(px.discard.length),
              voters: fmt(px.voterDeck.length),
            })}
          >
            {[px.draw.length, px.discard.length, px.voterDeck.length].map((n, i) => (
              <span key={i} className="pxstack">
                <PolitixIcon name="cardback" />
                <b>{fmt(n)}</b>
              </span>
            ))}
          </span>
        </div>

        <div className="pxgroups">
          {onTable.map((gr) => (
            <div key={gr} className="pxvgroup" data-group={gr}>
              {px.table
                .filter((v) => v.group === gr)
                .map((v) => (
                  <div
                    key={v.uid}
                    data-uid={v.uid}
                    className={cx("pxvcard", `pxg-${gr}`)}
                    title={t(`px.group.${gr}`)}
                  >
                    <span className="pxvtop">
                      <span className="pxmedal">
                        <PolitixIcon name={gr} />
                      </span>
                      <b>{t(`px.group.${gr}`)}</b>
                    </span>
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
          ))}
        </div>

        {/* Read aloud only: its numbers are drawn on the party plates. */}
        <div className="pxscore">
          <span>
            <b>
              {inPlay.length === 2
                ? t("px.scoreHead2", { a: names[inPlay[0]], b: names[inPlay[1]] })
                : t("px.scoreHead", {
                    a: names[inPlay[0]],
                    b: names[inPlay[1]],
                    c: names[inPlay[2]],
                  })}
            </b>
          </span>
          {PX_GROUPS.map((gr, i) => (
            <span key={gr}>
              {inPlay.length === 2
                ? t("px.score2", {
                    group: t(`px.group.${gr}`),
                    a: fmt(px.collected[inPlay[0]][i]),
                    b: fmt(px.collected[inPlay[1]][i]),
                  })
                : t("px.score", {
                    group: t(`px.group.${gr}`),
                    a: fmt(px.collected[inPlay[0]][i]),
                    b: fmt(px.collected[inPlay[1]][i]),
                    c: fmt(px.collected[inPlay[2]][i]),
                  })}
            </span>
          ))}
        </div>
        <div className="pxlast" title={lastText}>
          {lastText}
        </div>
        <div className="pxsymbols">
          {inPlay.map((id) => {
            const sym = PX_PARTY_SYMBOL[id];
            return (
              <PolitixBonusFace
                key={id}
                className={cx("pxparty", `pxg-${sym.group}`)}
                title={t("px.partyInfo", {
                  party: names[id],
                  symbol: t(`px.symbol.${sym.symbol}`),
                  group: t(`px.group.${sym.group}`),
                  bonus: fmt(PX_SYMBOL_BONUS),
                })}
                data-party={id}
              >
                <span className="pxpartyhead">
                  <PolitixIcon name={sym.symbol} />
                  <span className="pxlabel">{names[id]}</span>
                  <span className="pxsymbonus">
                    <PolitixIcon name={sym.group} />+{fmt(PX_SYMBOL_BONUS)}
                  </span>
                </span>
                <span className="pxtallies">
                  {PX_GROUPS.map((gr, i) => (
                    <span key={gr} className="pxtally" title={t(`px.group.${gr}`)}>
                      <PolitixIcon name={gr} />
                      {fmt(px.collected[id][i])}
                    </span>
                  ))}
                </span>
              </PolitixBonusFace>
            );
          })}
        </div>
      </div>
      <div className="pxseats">
        {seats.map((s) => {
          const pol = PX_POLITICIANS.find((x) => x.id === px.politicians[s]);
          const party = px.party[s];
          const sym = party ? PX_PARTY_SYMBOL[party] : null;
          const faces = pxPileFaces(px.burn[s], px.scandals[s]);
          const cards = [px.burn[s], ...px.scandals[s]];
          return (
            <div key={s} data-seat={s} className={cx("pxseat", px.turn === s && "turn")}>
              <div className="pxseattext">
                <span
                  className={cx("pxavatar", sym && `pxg-${sym.group}`)}
                  title={party ? names[party] : undefined}
                >
                  {sym && <PolitixIcon name={sym.symbol} />}
                  {last && last.p === s && lastIcon && (
                    <span className="pxlastbadge" title={lastText} aria-label={lastText}>
                      <PolitixIcon name={lastIcon} />
                      {last.what === "take" && <b>{t("px.count", { n: fmt(last.n) })}</b>}
                    </span>
                  )}
                </span>
                <b className="pxname">{seatName(s, you)}</b>
                <small className="pxhandn">{t("px.hand", { n: fmt(px.hands[s].length) })}</small>
              </div>
              <div className="pxpile" style={css({ "--k": faces.length })}>
                {faces.map((f, i) => {
                  const card = cards.find((c) => c?.uid === f.uid);
                  return card ? (
                    <PolitixCardFace
                      key={f.uid}
                      card={card}
                      count={f.count}
                      style={css({ "--i": i })}
                    />
                  ) : null;
                })}
                {pol && sym && (
                  <PolitixBonusFace className={cx("pxpol", `pxg-${sym.group}`)}>
                    <span className="pxpolname">
                      <PolitixIcon name="politician" />
                      <span className="pxlabel">{nameOf(pol)}</span>
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
                  </PolitixBonusFace>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
