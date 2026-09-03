import type { ComponentPropsWithoutRef } from "react";
import { chipValue, enhOf, isStone, partyOf } from "../game/cards";
import { SM, rankLabel } from "../game/constants";
import { ENH, PARTIES } from "../game/content";
import { useGameState } from "../hooks/useGame";
import { useI18n } from "../i18n/useI18n";
import { cx } from "./cx";
import type { Card } from "../game/types";

type Props = { card: Card; className?: string; twin?: boolean } & Omit<
  ComponentPropsWithoutRef<"div">,
  "className" | "title" | "children"
>;

/* One card. Its chip value depends on the game state (the sharpener voucher,
   the red boss), so the card reads the state itself — cheaper than threading
   the value through every call site. */
export function PlayingCard({ card, className, twin, ...rest }: Props) {
  const g = useGameState();
  const { nameOf, emblemOf } = useI18n();
  const chips = chipValue(g, card);
  const party = PARTIES.find((p) => p.id === partyOf(g, card));

  /* A stone card plays with no suit and no rank, so its face shows neither —
     except in the tuppipakka, where the suit and rank are the whole point:
     they say which card it can be swapped in for. Muted, so it never reads as
     a card that could follow suit.

     The party emblem is *not* behind that gate: a party is not a suit and
     cannot be followed, so printing it says nothing about what the card can
     do in the trick. Every card carries its party on its face, a stone card
     included. */
  if (isStone(card))
    return (
      <div className={cx("card", "e-stone", className)} title={nameOf(ENH.stone)} {...rest}>
        {twin && (
          <span className="twin">
            {rankLabel(card.r)}
            {SM[card.s].g}
          </span>
        )}
        <span className="big">◼</span>
        {party && <span className="pemblem">{emblemOf(party)}</span>}
        <span className="chip">+{chips}</span>
      </div>
    );

  const m = SM[card.s];
  const e = enhOf(card);
  return (
    <div
      className={cx("card", m.red && "red", card.enh && "e-" + card.enh, className)}
      title={e ? nameOf(e) : undefined}
      {...rest}
    >
      <span className="r">{rankLabel(card.r)}</span>
      <span className="sm">{m.g}</span>
      <span className="big">{m.g}</span>
      {e && <span className="ebadge">{e.g}</span>}
      {party && <span className="pemblem">{emblemOf(party)}</span>}
      <span className="chip">+{chips}</span>
    </div>
  );
}
