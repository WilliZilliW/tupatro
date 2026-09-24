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
      ) : g.challenge === "politiikka" && card.s === "D" && card.r === 13 ? (
        <span className="portrait">
          <KokoomusLeader />
        </span>
      ) : g.challenge === "politiikka" && card.s === "S" && card.r === 12 ? (
        <span className="portrait">
          <PsLeader />
        </span>
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
          <DiamondCornflower />
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
      {/* Spades keep the plain ♠ glyph above, unlike the other three suits —
         the party mark sits in its own corner badge instead, PS rather than
         a redrawn suit pip, so the ordinary spade is never mistaken for a
         card the game reads differently. Politiikka-only, the same as the
         suit icons and the two caricature honours. */}
      {g.challenge === "politiikka" && card.s === "S" && <span className="psbadge">PS</span>}
      {party && <span className={cx("pemblem", govParty && "govparty")}>{emblemOf(party)}</span>}
      {!noChip && <span className="chip">{chip}</span>}
    </div>
  );
}

/* Politiikka reads suits as party colours already — the clubs/hearts/diamonds
   green/red/blue this mode draws on are the ordinary --suit-c/--suit-h/
   --suit-d this file never touches, so an SVG with fill="currentColor" picks
   the right one up for free from .card.s-*, the same way the plain glyph
   did. Stylised, not a trace of any party's actual mark: a four-leaf clover
   for Keskusta, a sharp V for Vasemmistoliitto, a cornflower for Kokoomus —
   all three drawn from scratch as simple flat shapes, not reproductions.
   Spades stay the plain ♠ glyph; Perussuomalaiset's own mark is a corner
   badge instead (`.psbadge`, beside this function group), not a redrawn
   suit pip, so an ordinary spade is never mistaken for a card the game
   reads differently. Only clubs, hearts and diamonds have their glyph
   replaced; the three existing honours (♣K, ♣Q, ♥Q/Sofia) keep their own
   portraits above, unconditional in every mode, exactly as before. Two more
   honours exist now, but Politiikka-only rather than unconditional like
   those three: ♦K and ♠Q are Kokoomus's and Perussuomalaiset's own party
   leaders, drawn as caricatures rather than photographs — see
   KokoomusLeader and PsLeader, below the three suit icons — because this
   mode's own satire is what asked for them, and every other mode has no
   reason to draw a caricature of either. Everywhere else, ♦K draws the
   ordinary diamond icon like any other diamond, and ♠Q the plain glyph plus
   the psbadge every other spade in this mode also carries. */
function ClubClover() {
  /* The four leaves used to touch dead centre, which read as one solid
     blob rather than four separate leaflets — pulling each circle a
     little further from the pivot than its own radius reaches leaves a
     sliver of the card's own colour between neighbours instead. A
     slight clockwise tilt on the whole clover, leaves and stem together,
     is what keeps it from reading as a rigid plus sign. */
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
      <g transform="rotate(12 16 16)">
        <circle cx="16" cy="8.8" r="4.7" />
        <circle cx="16" cy="23.2" r="4.7" />
        <circle cx="8.8" cy="16" r="4.7" />
        <circle cx="23.2" cy="16" r="4.7" />
        <rect x="14.6" y="18" width="2.8" height="11" rx="1.4" />
      </g>
    </svg>
  );
}

function HeartRose() {
  /* A V, softened toward the suit it sits on rather than the razor-edged one
     the first draft drew — Vasemmistoliitto's own initial, still, but round
     caps and a round join in place of square and mitre take the harshness
     off the ends and the point, and each leg bows gently outward (a
     quadratic curve, not a straight line) rather than cutting a perfectly
     rigid angle — the same gentle convexity a heart's own two lobes have.
     The two legs are two separate strokes now, not one path of a single
     width, because a heart's own left lobe reads fuller than its right —
     the left leg carries a noticeably heavier stroke, the right a lighter
     one, and both round caps meet at the same bottom point so the taper
     still reads as one unbroken V rather than two halves stuck together. */
  return (
    <svg viewBox="0 0 32 32" width="27" height="27" aria-hidden="true">
      <path
        d="M6.5 4 Q9.5 16 16 25"
        fill="none"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 25 Q22.5 16 25.5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiamondCornflower() {
  /* Ruiskaunokki, Kokoomus's own long-standing flower. Nine petals, not the
     eleven thin triangles a first attempt used — those had no width to
     them and read as a star or an asterisk rather than a bloom. Each petal
     is a lance shape, narrow where it leaves the centre and widest a little
     past halfway, with a small notch bitten out of its own tip — the
     fringed, slightly frayed outline a cornflower's own ray florets have,
     rather than a clean point. Array.map rather than nine hand-written
     <path> lines, unlike the fans above and below — the count only needed
     picking once, not nine near-duplicate lines kept in sync by hand. */
  const pivot = "16 15";
  const petals = 9;
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true">
      <g>
        {Array.from({ length: petals }, (_, i) => (
          <path
            key={i}
            d="M16 4.2c-1.7 2.6-2.6 5-2.6 7.1 0 1 .5 1.7 1.1 1.7l1-1.3.5 1.6.5-1.6 1 1.3c.6 0 1.1-.7 1.1-1.7 0-2.1-.9-4.5-2.6-7.1z"
            transform={`rotate(${(360 / petals) * i} ${pivot})`}
          />
        ))}
      </g>
      <circle cx="16" cy="15" r="3.6" opacity=".6" />
      <rect x="14.6" y="22.4" width="2.8" height="6.6" rx="1.4" />
    </svg>
  );
}

/* The King of Diamonds and Queen of Spades, in Politiikka alone: caricatures
   of Kokoomus's and Perussuomalaiset's own party leaders, not photographs —
   flat, exaggerated cartoon shapes in the same hand-drawn-from-shapes
   register as the four suit icons above, sized to the same 40px circular
   .portrait frame the three fictional honours already use. Drawn, not
   photographed, and not gated on a real person's own consent to be one:
   caricature of a sitting public official is the oldest form of political
   satire there is, which a photograph reproduced verbatim is not. */
function KokoomusLeader() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <circle cx="20" cy="18" r="13" fill="#E3B896" />
      <path
        d="M7 16c-.3-7.4 5.6-13 13-13s13.3 5.6 13 13c-.5-2.6-2-4-4-4.2.4 1.6-1 2.6-3.4 2-2.8-.7-4.7.2-6.1 2-1.8-2.3-4-2.8-6.3-1.8-2 .9-2.8 2-2.9 4.4-1.6-.4-2.9-1-3.3-2.4z"
        fill="#6B5B4A"
      />
      <circle cx="7.4" cy="19.5" r="2.2" fill="#E3B896" />
      <circle cx="32.6" cy="19.5" r="2.2" fill="#E3B896" />
      <rect
        x="8.6"
        y="16.4"
        width="9"
        height="6.6"
        rx="1.6"
        fill="none"
        stroke="#2A2420"
        strokeWidth="2"
      />
      <rect
        x="22.4"
        y="16.4"
        width="9"
        height="6.6"
        rx="1.6"
        fill="none"
        stroke="#2A2420"
        strokeWidth="2"
      />
      <rect x="17.6" y="18.6" width="4.8" height="1.8" fill="#2A2420" />
      <path
        d="M15.5 27.5c2 1.6 7 1.6 9 0"
        stroke="#8A5A4A"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M2 40c1-6.5 7.5-9.5 18-9.5s17 3 18 9.5z" fill="#1B2A4A" />
      <path d="M17 31.5l3 3 3-3-1 8.5h-4z" fill="#B23A2D" />
    </svg>
  );
}

function PsLeader() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <path
        d="M20 5.5c-7.8 0-12.8 5.8-12.8 12.8 0 4.8 1 8.8 1.9 11.7h3.8c-1-3.8-1.1-7.8-.2-10.8 1 2 3.2 3 7.3 3s6.3-1 7.3-3c.9 3 .8 7-.2 10.8h3.8c.9-2.9 1.9-6.9 1.9-11.7 0-7-5-12.8-12.8-12.8z"
        fill="#D9C08A"
      />
      <circle cx="20" cy="19.5" r="10.2" fill="#EFC7A6" />
      <circle cx="16.2" cy="18.5" r="1.1" fill="#4A3A2A" />
      <circle cx="23.8" cy="18.5" r="1.1" fill="#4A3A2A" />
      <path
        d="M17 24.5c1.5 1.1 4.5 1.1 6 0"
        stroke="#A85A4A"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M4 40c1-6.4 7.4-9.4 16-9.4s15 3 16 9.4z" fill="#2C2440" />
    </svg>
  );
}
