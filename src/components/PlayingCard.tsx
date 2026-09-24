import type { ComponentPropsWithoutRef } from "react";
import katriRistiakka from "../assets/katri-ristiakka.png";
import sofia from "../assets/sofia.png";
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
      ) : isSofia(card) ? (
        <img className="portrait" src={sofia} alt="" />
      ) : g.challenge === "politiikka" && card.s === "C" ? (
        <span className="big">
          <ClubClover />
        </span>
      ) : g.challenge === "politiikka" && card.s === "H" ? (
        <span className="big">
          <HeartRose />
        </span>
      ) : g.challenge === "politiikka" && card.s === "D" ? (
        <span className="big">
          <DiamondFlame />
        </span>
      ) : g.challenge === "politiikka" && card.s === "S" ? (
        <span className="big">
          <SpadeLion />
        </span>
      ) : (
        <span className="big">{m.g}</span>
      )}
      {e && <span className="ebadge">{e.g}</span>}
      {/* Sofia's portrait above is unconditional, the same as the two club
         honours': the ♥Q is a named character wherever it is drawn, not only
         where her rule applies. The letter badge below is the opposite —
         Politiikka's own rule marker, not an identity — so it stays gated to
         the one mode that rule exists in; everywhere else she is a portrait
         with no badge, same as a face card with no enhancement carries no
         ebadge. */}
      {g.challenge === "politiikka" && isSofia(card) && <span className="sofia">S</span>}
      {party && <span className={cx("pemblem", govParty && "govparty")}>{emblemOf(party)}</span>}
      {!noChip && <span className="chip">{chip}</span>}
    </div>
  );
}

/* Politiikka reads suits as party colours already — the clubs/hearts green
   and red this mode draws on are the ordinary --suit-c/--suit-h this file
   never touches, so an SVG with fill="currentColor" picks the right one up
   for free from .card.s-C/.card.s-H, the same way the plain glyph did.
   Stylised, not a trace of any party's actual mark: a four-leaf clover for
   Keskusta, a rose bloom for Vasemmistoliitto, a flame for Kokoomus, a lion
   crest for Perussuomalaiset — all four drawn from scratch as simple flat
   shapes, not reproductions. Only the ordinary suit glyph is replaced; the
   honours (♣K, ♣Q, ♥Q/Sofia) keep their own portraits above, unconditional
   in every mode, exactly as before — no honour was added for ♦K or ♠Q, so
   those two simply draw their suit's new icon like every other card in it. */
function ClubClover() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
      <circle cx="16" cy="10" r="6.4" />
      <circle cx="16" cy="22" r="6.4" />
      <circle cx="10" cy="16" r="6.4" />
      <circle cx="22" cy="16" r="6.4" />
      <rect x="14.6" y="17" width="2.8" height="10" rx="1.4" />
    </svg>
  );
}

function HeartRose() {
  /* Five petals fanned around one pivot reads as a bloom at a glance, the
     way a bare cluster of circles did not — each ellipse is the same shape,
     rotated 72° more than the last about the pivot the pinwheel turns on. */
  const pivot = "16 13";
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true">
      <g>
        <ellipse cx="16" cy="7.8" rx="3.4" ry="5.4" />
        <ellipse cx="16" cy="7.8" rx="3.4" ry="5.4" transform={`rotate(72 ${pivot})`} />
        <ellipse cx="16" cy="7.8" rx="3.4" ry="5.4" transform={`rotate(144 ${pivot})`} />
        <ellipse cx="16" cy="7.8" rx="3.4" ry="5.4" transform={`rotate(216 ${pivot})`} />
        <ellipse cx="16" cy="7.8" rx="3.4" ry="5.4" transform={`rotate(288 ${pivot})`} />
      </g>
      <circle cx="16" cy="13" r="2.4" opacity=".55" />
      <rect x="14.8" y="19.5" width="2.4" height="9.5" rx="1.2" />
      <path d="M17.2 23.5c2.3-1.5 4.8-1.2 5.9 1-2.4 1.3-4.9 1-5.9-1z" />
    </svg>
  );
}

function DiamondFlame() {
  /* A point tapering into a rounded belly, the classic flame silhouette —
     the inner flame is the same shape at half scale and half opacity for
     the two-tone flicker, the same "smaller shape laid over the big one"
     trick HeartRose's own centre uses. */
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M16 3c-6 7-8.5 11-8.5 15.5a8.5 8.5 0 0 0 17 0C24.5 14 22 10 16 3z" />
      <path
        d="M16 11c-3 3.5-4.3 5.8-4.3 8.3a4.3 4.3 0 0 0 8.6 0c0-2.5-1.3-4.8-4.3-8.3z"
        opacity=".5"
      />
      <rect x="14.6" y="24.6" width="2.8" height="4.4" rx="1.4" />
    </svg>
  );
}

function SpadeLion() {
  /* The same fanned-shape trick HeartRose uses, angular rather than round: a
     mane of spikes around a face reads as a lion crest at a glance without
     needing an actual animal outline drawn freehand. A head alone, no body —
     two eye dots and a small snout, cut out of the mane in the card's own
     paper colour (the same negative-space trick a stencil uses) are what
     turn "spiky sun" into "face"; a body under it read as a robe rather
     than an animal at this size, so it is left off entirely. */
  const pivot = "16 15";
  return (
    <svg viewBox="0 0 32 32" width="27" height="27" fill="currentColor" aria-hidden="true">
      <g>
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" />
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" transform={`rotate(45 ${pivot})`} />
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" transform={`rotate(90 ${pivot})`} />
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" transform={`rotate(135 ${pivot})`} />
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" transform={`rotate(180 ${pivot})`} />
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" transform={`rotate(225 ${pivot})`} />
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" transform={`rotate(270 ${pivot})`} />
        <path d="M16 6.5 L18.1 12.2 L13.9 12.2 Z" transform={`rotate(315 ${pivot})`} />
      </g>
      <circle cx="16" cy="15" r="6.6" />
      <circle cx="13.4" cy="13.8" r="1" fill="var(--paper)" />
      <circle cx="18.6" cy="13.8" r="1" fill="var(--paper)" />
      <path d="M16 15.6l-1.6 2h3.2z" fill="var(--paper)" />
    </svg>
  );
}
