import { CHALLENGES } from "../../game/content";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

/* The whole rail of a challenge run, in one plate. Nothing here reads money,
   jokers, the tuppipakka, consumables, the blind or the target: a challenge
   has none of them, and a plate that drew a zero would be a lie about a shell
   that is not there. */
export function ChallengePlate() {
  const g = useGameState();
  const { t, fmt, nameOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === g.challenge) ?? CHALLENGES[0];
  const n = Math.min(g.deals, g.deals - g.dealsLeft + 1);

  return (
    <div className="plate chalplate">
      <div className="lbl">{nameOf(row)}</div>
      <div className="chalrowline">
        <span>{t("chal.deal", { n, total: g.deals })}</span>
        <b>{fmt(g.blindScore)}</b>
      </div>
      <div className="chalrowline">
        <span>{t("chal.tricks")}</span>
        <b>
          {g.usTricks}–{g.themTricks}
        </b>
      </div>
      {g.phase === "laydown" && (
        <>
          <div className="chalrowline">
            <span>
              {t("chal.laid")} · {t("chal.us")}
            </span>
            <b>{fmt(g.layScores[0])}</b>
          </div>
          <div className="chalrowline">
            <span>
              {t("chal.laid")} · {t("chal.them")}
            </span>
            <b>{fmt(g.layScores[1])}</b>
          </div>
        </>
      )}
    </div>
  );
}
