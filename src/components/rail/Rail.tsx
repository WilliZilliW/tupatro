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

export function Rail() {
  const { ante, seed, phase, trickNo } = useGameState();
  const dispatch = useDispatch();
  const { t, locale, setLocale } = useI18n();

  /* The button shows the language you would switch to, not the current one. */
  const other = locale === "fi" ? "en" : "fi";

  return (
    <aside className="rail">
      <div className="brand">
        <h1>Tupatro</h1>
        <span>{t("rail.ante", { n: ante })}</span>
      </div>
      <div className="railtop">
        <button className="seedchip" onClick={() => dispatch({ type: "openModal", modal: "seed" })}>
          {t("seed.label")} <b>{seed}</b>
        </button>
        <button className="langbtn" title={LOCALE_NAMES[other]} onClick={() => setLocale(other)}>
          {LOCALE_NAMES[other]}
        </button>
      </div>

      <BlindPlate />
      <Slate />
      <Tally />
      <Stats />
      <JokerList />
      <SideDeckBox />
      <ConsumablesBox />
      {/* Last of the plates: thirteen read-only rows with no decision attached,
          and the rail scrolls. Above the consumable buttons they would push
          every control in the rail down by their own height on a short
          window. */}
      <SupportBox />

      <div className="railbtns">
        <button className="tinybtn" onClick={() => dispatch({ type: "openModal", modal: "rules" })}>
          {t("btn.rules")}
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
    </aside>
  );
}
