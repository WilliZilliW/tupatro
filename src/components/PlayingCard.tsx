import type { ComponentPropsWithoutRef } from "react";
import katriRistiakka from "../assets/katri-ristiakka.png";
import vaykka from "../assets/vaykka.png";
import {
  chipValue,
  enhOf,
  isKingOfClubs,
  isQueenOfClubs,
  isSofia,
  isStone,
  partyOf,
} from "../game/cards";
import { SM, rankLabel } from "../game/constants";
import { ENH, PARTIES } from "../game/content";
import { NAMI_VARIANT, namiValue } from "../game/nami";
import { governmentFor, termOf } from "../game/puolue";
import { useGameState } from "../hooks/useGame";
import { useViewSeat } from "../hooks/useSeat";
import { useI18n } from "../i18n/useI18n";
import { cx } from "./cx";
import type { Card } from "../game/types";

type Props = { card: Card; className?: string; twin?: boolean } & Omit<
  ComponentPropsWithoutRef<"div">,
  "className" | "title" | "children"
>;

/* One card. Its chip value depends on the game state (the sharpener voucher,
   the red boss), so the card reads the state itself — cheaper than threading
   the value through every call site.

   The chip number follows the *viewer*: the sharpener sits in a wallet, so
   the printed value answers "what is this card worth to me". The pure
   chipValue still takes the seat as a parameter, so nothing in the core
   learns who is looking, and in single player the viewer is the owner. */
export function PlayingCard({ card, className, twin, ...rest }: Props) {
  const g = useGameState();
  const { nameOf, emblemOf, fmt } = useI18n();
  const chips = chipValue(g, useViewSeat(), card);
  const party = PARTIES.find((p) => p.id === partyOf(g, card));
  /* Politiikka marks a government party's emblem, and only in that mode: the
     government is derived from the seed rather than stored (see puolue.ts),
     so this is the same on-demand computation GovBox makes, not a state read.
     Every other mode draws the plain emblem it always has. */
  const govParty =
    g.challenge === "politiikka" &&
    party !== undefined &&
    governmentFor(g.seed, termOf(g.raceDeal)).includes(party.id);
  /* Nami's whole point is that the game does the arithmetic and the player
     only decides which card to play, so a Nami deal prints the mode's own
     signed value here instead of a chip count that means nothing in it — the
     same pre-existing wart Traditional Tuppi's chip corner already is, and
     this spec does not extend the fix to that mode. */
  const namiVariant =
    g.challenge === "nami" || g.challenge === "namihard" ? NAMI_VARIANT[g.challenge] : null;
  const namiVal = namiVariant ? namiValue(namiVariant, card) : null;
  const chip = namiVal !== null ? (namiVal >= 0 ? `+${fmt(namiVal)}` : fmt(namiVal)) : `+${chips}`;
  /* Rock-Paper-Scissors scores nothing at all: the suit is the whole card and
     a chip count printed beside it would be a number the mode never adds up.
     Hidden rather than repurposed into a throw glyph — a new symbol would
     need a tofu probe, and the suit pip plus the felt's legend already carry
     the mapping. */
  const noChip = g.challenge === "rps";

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
        {party && <span className={cx("pemblem", govParty && "govparty")}>{emblemOf(party)}</span>}
        {!noChip && <span className="chip">+{chips}</span>}
      </div>
    );

  const m = SM[card.s];
  const e = enhOf(card);
  /* A physical tuppi deck has two colours, not four: Traditional Tuppi and
     the Tuppi Race are dealt from it, everywhere else keeps the four-colour
     deck 2026-09-16-four-suit-colors delivered. Tupatro is Traditional
     Tuppi's twin in every other way but is left out here — the requirement
     named these two modes and not it, so it defaults to four colours. */
  const trad = g.challenge === "tuppi" || g.challenge === "race";
  return (
    <div
      className={cx("card", "s-" + card.s, trad && "trad", card.enh && "e-" + card.enh, className)}
      title={e ? nameOf(e) : undefined}
      {...rest}
    >
      <span className="r">{rankLabel(card.r)}</span>
      <span className="sm">{m.g}</span>
      {isKingOfClubs(card) ? (
        <img className="portrait" src={vaykka} alt="" />
      ) : isQueenOfClubs(card) ? (
        <img className="portrait" src={katriRistiakka} alt="" />
      ) : (
        <span className="big">{m.g}</span>
      )}
      {e && <span className="ebadge">{e.g}</span>}
      {/* Politiikka's own marker: the ♥Q shouts down every trick she is
          played into. A plain ASCII letter, no new image asset — a match has
          no shop and no tuppipakka to draw a portrait's precedent from — and
          it draws nowhere else: outside this mode the ♥Q is an ordinary
          queen. */}
      {g.challenge === "politiikka" && isSofia(card) && <span className="sofia">S</span>}
      {party && <span className={cx("pemblem", govParty && "govparty")}>{emblemOf(party)}</span>}
      {!noChip && <span className="chip">{chip}</span>}
    </div>
  );
}
