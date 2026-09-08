import { useRef, useState, type ReactNode, type UIEvent } from "react";
import { ANTES } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { LOCALE_NAMES } from "../../i18n";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { BlindPlate } from "./BlindPlate";
import { ChallengePlate } from "./ChallengePlate";
import { ConsumablesBox } from "./ConsumablesBox";
import { JokerList } from "./JokerList";
import { RacePlate } from "./RacePlate";
import { SideDeckBox } from "./SideDeckBox";
import { Slate } from "./Slate";
import { Stats } from "./Stats";
import { SupportBox } from "./SupportBox";
import { Tally } from "./Tally";

/* Below 560px the plates are laid out as pages side by side in a horizontal
   scroller, one page filling the strip. Above it the wrappers are
   display:contents and the rail is the column it has always been, so the count
   is only ever the clamp on the scroll index and on the arrows.

   The page list is built from the state, because four of the main game's five
   pages describe a shell a challenge does not have. */
export function Rail() {
  const { ante, seed, challenge } = useGameState();
  const dispatch = useDispatch();
  const { t, locale, nameOf, setLocale } = useI18n();
  const spectating = useSpectating();
  const chalRow = CHALLENGES.find((c) => c.id === challenge);

  /* The page index is component-local: it is a scroll position, not part of
     the run, so it belongs in neither GameState nor the save snapshot. */
  const [page, setPage] = useState(0);
  /* Indexed by the order a finger meets the pages, not by the DOM order: the
     arrows and the scroll index are the swipe's order, so they are this one. */
  const pageEls = useRef<Array<HTMLDivElement | null>>([]);
  const holdPage = (i: number) => (el: HTMLDivElement | null) => {
    pageEls.current[i] = el;
  };

  /* The scroll handler is what normally sets the index, but it never fires
     where scrollIntoView is a no-op, and an arrow that lights nothing would
     then stick. Set it here too; a real scroll corrects it a frame later. */
  const go = (i: number) => {
    const to = Math.min(pages.length - 1, Math.max(0, i));
    setPage(to);
    /* jsdom implements no scrollIntoView (the property is undefined), and the
       render tests click these. block:"nearest" keeps the browser from
       scrolling an ancestor vertically to reveal the page, which would move
       the felt. */
    pageEls.current[to]?.scrollIntoView?.({ block: "nearest", inline: "start" });
  };

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = e.currentTarget;
    /* The strip is display:contents at every width but the phone one, and
       jsdom lays nothing out at all: dividing by a zero width would make the
       index NaN and leave both arrows enabled at the ends of the strip. */
    if (clientWidth === 0) return;
    const i = Math.round(scrollLeft / clientWidth);
    setPage(Math.min(pages.length - 1, Math.max(0, i)));
  };

  /* The button shows the language you would switch to, not the current one. */
  const other = locale === "fi" ? "en" : "fi";

  const gamePage: ReactNode = (
    <>
      <div className="railtop">
        <button className="seedchip" onClick={() => dispatch({ type: "openModal", modal: "seed" })}>
          {t("seed.label")} <b>{seed}</b>
        </button>
        <button className="langbtn" title={LOCALE_NAMES[other]} onClick={() => setLocale(other)}>
          {LOCALE_NAMES[other]}
        </button>
      </div>

      <div className="railbtns">
        <button className="tinybtn" onClick={() => dispatch({ type: "openModal", modal: "rules" })}>
          {t("btn.rules")}
        </button>
        <button
          className="tinybtn"
          onClick={() => dispatch({ type: "openModal", modal: "scores" })}
        >
          {t("btn.scores")}
        </button>
        {/* The rail no longer starts a run itself: it raises the menu, and
            Continue there returns to the run untouched. The shared table has
            no run of its own to start, and the menu it would raise carries
            buttons that do: the banner's Leave is its one way off. Rules and
            SCORES stay — somebody at the shared screen looking a rule up is
            what the panel is for. */}
        {!spectating && (
          <button className="tinybtn" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
            {t("btn.newGame")}
          </button>
        )}
      </div>
    </>
  );

  /* In the order a finger meets the pages, not the DOM's: see below. */
  /* `chalRow` is any challenge — which page list to draw is the same question
     for all of them — but which plate fills the first page is the mode's, so
     that one tests the id. */
  const pages: Array<{ cls: string; body: ReactNode }> = chalRow
    ? [
        { cls: "rp-challenge", body: chalRow.id === "race" ? <RacePlate /> : <ChallengePlate /> },
        { cls: "rp-game", body: gamePage },
      ]
    : [
        {
          cls: "rp-blind",
          body: (
            <>
              <BlindPlate />
              <Slate />
            </>
          ),
        },
        {
          cls: "rp-deal",
          body: (
            <>
              <Tally />
              <Stats />
            </>
          ),
        },
        {
          cls: "rp-kit",
          body: (
            <>
              <JokerList />
              <SideDeckBox />
              <ConsumablesBox />
            </>
          ),
        },
        /* Thirteen read-only rows with no decision attached: last of the
           plates in the column, and a page of its own on a phone. */
        { cls: "rp-support", body: <SupportBox /> },
        { cls: "rp-game", body: gamePage },
      ];

  /* The DOM cannot follow the swipe in a main-game run: one wrapper has to
     hold both the seed chip and the footer, DOM positions 2 and 11, so the
     game page is written first and .rp-game{order:1} puts it back last on the
     strip. A two-page challenge strip has nothing to write before it, so its
     DOM order is its swipe order. */
  const domOrder = chalRow ? [0, 1] : [4, 0, 1, 2, 3];

  return (
    <aside className="rail">
      {/* On no page: the line is worth its 29px on every one of them. */}
      <div className="brand">
        <h1>Tupatro</h1>
        <span>{chalRow ? nameOf(chalRow) : t("rail.ante", { n: ante, total: ANTES.length })}</span>
      </div>

      <div className="railstrip" onScroll={onScroll}>
        {domOrder.map((i) => (
          <div className={`railpage ${pages[i].cls}`} key={pages[i].cls} ref={holdPage(i)}>
            {pages[i].body}
          </div>
        ))}
      </div>

      {/* Two arrows rather than a row of dots: a swipe does not reach every page on
          every device, so the strip needs a control that always turns it. The
          glyphs are language-neutral symbols drawn by the stylesheet, so the
          buttons carry no text — which is exactly why they carry a label. */}
      <div className="railnav">
        <button
          type="button"
          className="railarrow prev"
          aria-label={t("rail.prevPage")}
          disabled={page === 0}
          onClick={() => go(page - 1)}
        />
        <button
          type="button"
          className="railarrow next"
          aria-label={t("rail.nextPage")}
          disabled={page === pages.length - 1}
          onClick={() => go(page + 1)}
        />
      </div>
    </aside>
  );
}
