import { econOf } from "../../game/economy";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";

/* A trick *is* its button — name, description and all — so a shared table sees
   the count and not the row. That is the read-only rule winning over the
   listing, and it costs a display nothing that matters: `useConsumable` is a
   `seat` action, and a row drawn on a window that cannot spend it would be a
   control that lies. */
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
            <MoveButton
              key={c.id + i}
              className="consbtn"
              disabled={banned}
              onClick={() => dispatch({ type: "useConsumable", p: you, index: i })}
            >
              <div className="nm">{nameOf(c)}</div>
              <div className="tx">{descOf(c)}</div>
            </MoveButton>
          ))}
        </div>
      )}
    </div>
  );
}
