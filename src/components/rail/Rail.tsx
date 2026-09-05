import { useRef, useState, type UIEvent } from "react";
import { ANTES } from "../../game/constants";
import { LOCALE_NAMES } from "../../i18n";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { BlindPlate } from "./BlindPlate";
import { ConsumablesBox } from "./ConsumablesBox";
import { JokerList } from "./JokerList";
import { SideDeckBox } from "./SideDeckBox";
import { Slate } from "./Slate";
import { Stats } from "./Stats";
import { SupportBox } from "./SupportBox";
import { Tally } from "./Tally";

/* Below 560px the plates are laid out as five pages side by side in a
   horizontal scroller, one page filling the strip. Above it the wrappers are
   display:contents and the rail is the column it has always been, so the count
   is only ever the clamp on the scroll index and on the arrows. */
const PAGES = 5;

export function Rail() {
  const { ante, seed, phase, trickNo } = useGameState();
  const dispatch = useDispatch();
  const { t, locale, setLocale } = useI18n();

  /* The page index is component-local: it is a scroll position, not part of
     the run, so it belongs in neither GameState nor the save snapshot. */
  const [page, setPage] = useState(0);
  /* Indexed by the order a finger meets the pages, not by the DOM order: the
     game page is written second because one wrapper has to hold both the seed
     chip and the footer, and .rp-game{order:1} moves it last on the strip. The
     arrows and the scroll index are the swipe's order, so they are this one. */
  const pages = useRef<Array<HTMLDivElement | null>>([]);
  const holdPage = (i: number) => (el: HTMLDivElement | null) => {
    pages.current[i] = el;
  };

  /* The scroll handler is what normally sets the index, but it never fires
     where scrollIntoView is a no-op, and an arrow that lights nothing would
     then stick. Set it here too; a real scroll corrects it a frame later. */
  const go = (i: number) => {
    const to = Math.min(PAGES - 1, Math.max(0, i));
    setPage(to);
    /* jsdom implements no scrollIntoView (the property is undefined), and the
       render tests click these. block:"nearest" keeps the browser from
       scrolling an ancestor vertically to reveal the page, which would move
       the felt. */
    pages.current[to]?.scrollIntoView?.({ block: "nearest", inline: "start" });
  };

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = e.currentTarget;
    /* The strip is display:contents at every width but the phone one, and
       jsdom lays nothing out at all: dividing by a zero width would make the
       index NaN and leave both arrows enabled at the ends of the strip. */
    if (clientWidth === 0) return;
    const i = Math.round(scrollLeft / clientWidth);
    setPage(Math.min(PAGES - 1, Math.max(0, i)));
  };

  /* The button shows the language you would switch to, not the current one. */
  const other = locale === "fi" ? "en" : "fi";

  return (
    <aside className="rail">
      {/* On no page: the ante is worth its 29px on all five of them. */}
      <div className="brand">
        <h1>Tupatro</h1>
        <span>{t("rail.ante", { n: ante, total: ANTES.length })}</span>
      </div>

      <div className="railstrip" onScroll={onScroll}>
        {/* The seed chip and the footer are DOM positions 2 and 11 today, and
            one wrapper cannot span them. The page goes where .railtop is and
            .railbtns{order:1} puts the footer back last wherever the rail is
            still a column; on a phone .rp-game{order:1} swipes it last. */}
        <div className="railpage rp-game" ref={holdPage(4)}>
          <div className="railtop">
            <button
              className="seedchip"
              onClick={() => dispatch({ type: "openModal", modal: "seed" })}
            >
              {t("seed.label")} <b>{seed}</b>
            </button>
            <button
              className="langbtn"
              title={LOCALE_NAMES[other]}
              onClick={() => setLocale(other)}
            >
              {LOCALE_NAMES[other]}
            </button>
          </div>

          <div className="railbtns">
            <button
              className="tinybtn"
              onClick={() => dispatch({ type: "openModal", modal: "rules" })}
            >
              {t("btn.rules")}
            </button>
            <button
              className="tinybtn"
              onClick={() => dispatch({ type: "openModal", modal: "scores" })}
            >
              {t("btn.scores")}
            </button>
            <button
              className="tinybtn"
              onClick={() =>
                /* Mid-deal a new run asks for confirmation; otherwise it starts at once. */
                phase === "play" && trickNo > 0
                  ? dispatch({ type: "openModal", modal: "restart" })
                  : dispatch({ type: "newRun" })
              }
            >
              {t("btn.newGame")}
            </button>
          </div>
        </div>

        <div className="railpage rp-blind" ref={holdPage(0)}>
          <BlindPlate />
          <Slate />
        </div>

        <div className="railpage rp-deal" ref={holdPage(1)}>
          <Tally />
          <Stats />
        </div>

        <div className="railpage rp-kit" ref={holdPage(2)}>
          <JokerList />
          <SideDeckBox />
          <ConsumablesBox />
        </div>

        {/* Thirteen read-only rows with no decision attached: last of the
            plates in the column, and a page of its own on a phone. */}
        <div className="railpage rp-support" ref={holdPage(3)}>
          <SupportBox />
        </div>
      </div>

      {/* Two arrows rather than five dots: a swipe does not reach every page on
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
          disabled={page === PAGES - 1}
          onClick={() => go(page + 1)}
        />
      </div>
    </aside>
  );
}
