import { useEffect, useRef, useState } from "react";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

/* Any string works as a seed. The same seed and the same decisions produce
   the same run. */
export function SeedDialog() {
  const { seed } = useGameState();
  const dispatch = useDispatch();
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
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => dispatch({ type: "newRun", seed: next })}>
          {t("btn.startRun")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "newRun", seed })}>
          {t("btn.replaySeed")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.cancel")}
        </button>
      </div>
    </Overlay>
  );
}
