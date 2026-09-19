import { PARTIES } from "../../game/content";
import { PUOLUE_TERM } from "../../game/constants";
import { governmentFor, termOf } from "../../game/puolue";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

/* Puoluepeli's own plate: the term's government, so the player can read the
   emblems PlayingCard marks against something. The government is derived
   from the seed rather than stored (see puolue.ts), so this recomputes it on
   demand exactly like PlayingCard's own marker does — both are pure, both
   are deterministic in the seed and the term, and neither reads or writes
   g.rngState, so recomputing costs nothing a saved field would have bought
   more cheaply.

   Fixed PARTIES order, the same reading SupportBox already gives: a list
   that reordered itself between two governments of the same size would be
   unreadable. */
export function GovBox() {
  const { seed, raceDeal } = useGameState();
  const { t, nameOf, emblemOf } = useI18n();
  const term = termOf(raceDeal);
  const gov = governmentFor(seed, term);
  const dealInTerm = ((raceDeal - 1) % PUOLUE_TERM) + 1;
  const left = PUOLUE_TERM - dealInTerm;

  return (
    <div className="plate chalplate">
      <div className="lbl">{t("gov.title")}</div>
      <div className="chalrowline">
        <span>{t("gov.term", { n: term })}</span>
        <b>{t("gov.dealsLeft", { n: left })}</b>
      </div>
      <div className="support">
        {PARTIES.filter((p) => gov.includes(p.id)).map((p) => (
          <div key={p.id} className="supportrow">
            <span className="pbadge">{emblemOf(p)}</span>
            <span className="pname">{nameOf(p)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
