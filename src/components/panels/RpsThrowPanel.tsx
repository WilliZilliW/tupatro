import { RPS_THROWS } from "../../game/rps";
import { useDispatch } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

/* The player's own throw. The three buttons are the decision and sit above
   the prose — the rule that broke three times in #declpanel, .replacepick and
   LaydownPanel — so they are reachable on a short window. */
export function RpsThrowPanel() {
  const dispatch = useDispatch();
  const you = useViewSeat();
  const { t } = useI18n();

  return (
    <>
      <h3>{t("rps.throwTitle")}</h3>
      <div className="row">
        {RPS_THROWS.map((th) => (
          <button
            key={th}
            className="btn"
            onClick={() => dispatch({ type: "throwRps", p: you, throw: th })}
          >
            {t(`rps.throw.${th}`)}
          </button>
        ))}
      </div>
      <p className="fine">{t("rps.throwHelp")}</p>
    </>
  );
}
