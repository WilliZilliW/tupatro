import { econOf } from "../../game/economy";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

export function ConsumablesBox() {
  const g = useGameState();
  const you = useViewSeat();
  const { consumables, consSlots } = econOf(g, you);
  const { boss } = g;
  const dispatch = useDispatch();
  const { t, nameOf, descOf } = useI18n();
  /* The reducer refuses the trick anyway; disabling the buttons says so before
     the click instead of answering it with a toast that vanishes. The note is
     drawn whether or not the player holds a trick, because it describes the
     blind rather than the box's contents. */
  const banned = boss?.id === "temppukielto";

  return (
    <div>
      <div className="lbl" style={{ marginBottom: 5 }}>
        {t("rail.tricksHeader")} {consumables.length}/{consSlots}
      </div>
      {banned && <div className="empty">{t("rail.tricksBanned")}</div>}
      {consumables.length === 0 ? (
        <div className="empty">{t("rail.noTricks")}</div>
      ) : (
        <div className="cons">
          {consumables.map((c, i) => (
            <button
              key={c.id + i}
              className="consbtn"
              disabled={banned}
              onClick={() => dispatch({ type: "useConsumable", p: you, index: i })}
            >
              <div className="nm">{nameOf(c)}</div>
              <div className="tx">{descOf(c)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
