import { TYPES } from "../../game/constants";
import { ENH, ENH_KEYS, PARTIES } from "../../game/content";
import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Rich } from "../Rich";

/* This panel is where the implementation's rules are documented. If a rule
   changes, this and the README change with it — otherwise the game teaches the
   player something false. */
export function Rules() {
  const dispatch = useDispatch();
  const { t, tList, nameOf, descOf, emblemOf } = useI18n();

  return (
    <Overlay>
      <h2>{t("rules.title")}</h2>
      <p className="dek">{t("rules.intro")}</p>
      <div className="rules">
        <div className="cols">
          <div>
            <h3>{t("rules.tuppiTitle")}</h3>
            <ul>
              {tList("rules.tuppi").map((x, i) => (
                <li key={i}>
                  <Rich text={x} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{t("rules.balatroTitle")}</h3>
            <ul>
              {tList("rules.balatro").map((x, i) => (
                <li key={i}>
                  <Rich text={x} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <h3>{t("rules.enhTitle")}</h3>
        <p>{t("rules.enhIntro")}</p>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("rules.enhCol")}</th>
              <th>{t("rules.effectCol")}</th>
            </tr>
          </thead>
          <tbody>
            {ENH_KEYS.map((k) => (
              <tr key={k}>
                <td>
                  {ENH[k].g} {nameOf(ENH[k])}
                </td>
                <td>{descOf(ENH[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>{t("rules.typesTitle")}</h3>
        <p>
          <Rich text={t("rules.typesIntro")} />
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("rules.trickCol")}</th>
              <th className="n">Chips</th>
              <th className="n">Mult</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(TYPES).map((ty) => (
              <tr key={ty.id}>
                <td>{t(`type.${ty.id}`)}</td>
                <td className="n">{ty.chips}</td>
                <td className="n">×{ty.mult}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>{t("rules.partiesTitle")}</h3>
        <ul>
          {tList("rules.parties").map((x, i) => (
            <li key={i}>
              <Rich text={x} />
            </li>
          ))}
        </ul>
        <table className="tbl">
          <tbody>
            {PARTIES.map((p) => (
              <tr key={p.id}>
                <td>
                  {emblemOf(p)} {nameOf(p)}
                </td>
                <td>{descOf(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: 10 }}>{t("rules.chipNote")}</p>
        <p style={{ marginTop: 10, fontSize: 12.5, color: "#8FA89A" }}>{t("rules.source")}</p>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}
