import { useEffect, useRef, useState } from "react";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";

/* Any string works as a seed. The same seed and the same decisions produce
   the same run. */
export function SeedDialog() {
  const { seed } = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const { t } = useI18n();
  const [next, setNext] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Overlay>
      <h2>{t("seed.title")}</h2>
      <p className="dek">{t("seed.intro")}</p>
      <div className="ln" style={{ border: 0, padding: 0 }}>
        <span className="lbl">{t("seed.current")}</span>
      </div>
      <input
        className="seedfield"
        value={seed}
        readOnly
        onClick={(e) => e.currentTarget.select()}
      />
      <p className="dek" style={{ margin: "12px 0 2px" }}>
        {t("seed.newPrompt")}
      </p>
      <input
        ref={inputRef}
        className="seedfield"
        value={next}
        placeholder={seed}
        maxLength={32}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setNext(e.target.value)}
      />
      {/* The rail's seed chip is an ordinary button — the modal is local, and
          reading the seed off the shared screen is what the chip is for — so
          this dialog is two clicks from a table window. The two buttons that
          start a run are not: they would be controls that lie. Cancel stays
          ordinary, or the table could not close what it opened. */}
      <div className="row" style={{ marginTop: 14 }}>
        <MoveButton
          className="btn"
          onClick={() => dispatch({ type: "newRun", seed: next, seat: you })}
        >
          {t("btn.startRun")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() => dispatch({ type: "newRun", seed, seat: you })}
        >
          {t("btn.replaySeed")}
        </MoveButton>
        <button className="btn ghost" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.cancel")}
        </button>
      </div>
    </Overlay>
  );
}
