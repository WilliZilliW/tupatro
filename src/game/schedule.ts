import { partnerOf } from "./constants";
import { rpsOver } from "./rps";
import { ownerSeat } from "./rules";
import type { Action } from "./actions";
import type { GameState, Seat } from "./types";

/* ============================ timing ============================
   The game advances by itself in several places: opponents declare and play,
   tricks resolve, hands end. Timing is stated as data rather than as calls:
   nextTick reports which action to dispatch and when, and React's effect
   cleanup cancels the timer when the state changes. Cancellation is therefore
   not a separate concern.

   `key` identifies the step. The effect depends on that alone, so rearranging
   your hand does not reset an opponent's turn timer. */

export type Tick = { key: string; action: Action; delay: number };

export function nextTick(g: GameState): Tick | null {
  /* The rail raises the start menu at any point, mid-deal included, where
     g.screen is null and every phase below still has a tick to give. The
     opponents must not play on behind the menu. */
  if (g.menu !== null) return null;

  switch (g.phase) {
    case "declare":
      if (g.declIdx >= 4)
        return { key: "declare:done", action: { type: "finishDeclare" }, delay: 0 };
      /* A human seat's own declaration is a decision, not a timer. */
      if (g.seats[g.declSeq[g.declIdx]] === "human") return null;
      return { key: `declare:${g.declIdx}`, action: { type: "aiDeclare" }, delay: 620 };

    case "soolioffer":
    case "sooligive":
    case "sooliready":
      /* Every mode that runs a declaration offers sooli to a bot defender
         now, the main run included — see
         2026-09-16-ai-takes-sooli-when-sensible. */
      if (g.sooliSeat === null || g.seats[g.sooliSeat] !== "ai") return null;
      return {
        key: `${g.phase}:${g.sooliSeat}`,
        action: { type: "aiSooli", p: g.sooliSeat, phase: g.phase },
        delay: 620,
      };

    case "play":
      if (g.seats[g.turn] === "human") return null;
      return {
        key: `play:${g.trickNo}:${g.trick.length}`,
        action: { type: "aiPlay" },
        delay: g.trick.length === 0 ? 700 : 560,
      };

    case "resolve":
      return { key: `resolve:${g.trickNo}`, action: { type: "resolveTrick" }, delay: 760 };

    case "trickend":
      /* A scored trick lingers, so the breakdown can be read. */
      return {
        key: `trickend:${g.trickNo}`,
        action: { type: "endTrick" },
        delay: g.pop ? 1250 : 650,
      };

    case "laydown":
      /* Only the opponents are on the clock here. The player's own turn
         returns null, so null still means "waiting for the player" and the
         headless driver never passes for a policy that has a move — the
         60-second cap on a human's thinking lives in useGameLoop instead. */
      /* layTurn is a team, and a team is a seat and its partner: team 0 is
         seats 0 and 2, team 1 is seats 1 and 3. Either of them being human
         makes the turn a decision rather than a step. */
      if (g.seats[g.layTurn] === "human" || g.seats[partnerOf(g.layTurn)] === "human") return null;
      return { key: `lay:${g.layNo}`, action: { type: "aiLaydown" }, delay: 900 };

    case "rpsthrow":
      /* The player's own decision — nothing to schedule, exactly like the
         declaration's own turn. */
      return null;

    case "rpsreveal":
      /* The match's own result lingers on rpsover: the phase deliberately
         stays rpsreveal while it is shown, so this step is done — do not
         repeat it, exactly as handend's own guard. */
      if (g.screen) return null;
      /* rpsRound only reaches RPS_ROUNDS once resolveRps has already scored
         the final round and deliberately left the screen null — see its own
         comment. That is a second, longer wait rather than the ordinary
         reveal delay below: the player just watched the match decide itself
         and deserves a beat to read it before the result screen covers the
         felt. showRpsOver is the step that opens it; its own key does not
         depend on the round, since the round no longer moves once this
         branch is reached, and firing it twice would fail the "already
         showing" guard above harmlessly, but there is nothing to gain from
         asking. */
      if (rpsOver(g.rpsRound))
        return { key: "rpsreveal:final", action: { type: "showRpsOver" }, delay: 2600 };
      /* Longer than the other ticks because three things happen inside it, in
         CSS with no timer of their own (see .rpsdown in index.css): the two
         cards lie face down for 0.4s, turn together over the next 0.3s — the
         reveal itself is done at 0.7s — and the round's verdict fades in at
         0.72s. The round then sits for 1.3s after that reveal before
         resolving: 0.7s + 1300ms = 2000ms, the delay between hands. */
      return {
        key: `rpsreveal:${g.rpsRound}`,
        action: { type: "resolveRps" },
        delay: 2000,
      };

    case "handend":
      /* The result is already on screen: the phase deliberately stays handend
         until the player continues, so the step is done — do not repeat it. */
      if (g.screen) return null;
      /* dealsLeft never moves in a race, so this key is `handend:0` at the end
         of every one of its deals. That is safe rather than sloppy: two
         consecutive handends are always separated by declare/play/resolve/
         trickend steps whose keys differ, so the effect re-fires anyway, and
         the guard above is what stops the step repeating within one deal. */
      return {
        key: `handend:${g.dealsLeft}`,
        action: { type: "showHandResult" },
        delay: 500,
      };

    default:
      return null;
  }
}

/* ==================== who the game is waiting for ====================
   The other half of nextTick's question: nextTick says what happens by itself,
   this says which human seat has to act before anything else can. Null under a
   menu, under a screen, in a phase that advances itself, and for a seat marked
   "ai" — the clock plays that one, so it is not waiting for anybody.

  It exists because a state may seat more than one human: the reducer refuses
  an action for a seat whose turn it is not, so an offline window has to follow
  the acting seat or the match stalls in silence with no error.
   useSeatSync is what reads it; the headless bot reads it too, so it acts for
   whichever seat the game is waiting on rather than for a fixed one. */
export function waitingSeat(g: GameState): Seat | null {
  if (g.menu !== null) return null;
  if (g.screen) return null;
  const human = (p: Seat): Seat | null => (g.seats[p] === "human" ? p : null);

  switch (g.phase) {
    /* The swap is the run owner's alone: the tuppipakka is the shell's, and
       the shell belongs to one seat. */
    case "swap":
      return human(ownerSeat(g));

    case "declare":
      if (g.declIdx >= 4) return null;
      return human(g.declSeq[g.declIdx]);

    case "soolioffer":
    case "sooligive":
    case "sooliready":
      return g.sooliSeat === null ? null : human(g.sooliSeat);

    case "play":
      return human(g.turn);

    case "rpsthrow":
      /* Always the run owner's own decision — see rps.ts's own comment for
         why only two of the four chairs ever play. */
      return human(ownerSeat(g));

    case "laydown":
      /* layTurn is a team, and a team is a seat and its partner. Either of
         them being human makes the turn a decision; the seat that acts is
         whichever of the two is. */
      return human(g.layTurn) ?? human(partnerOf(g.layTurn));

    default:
      return null;
  }
}

export const TOAST_MS = 2500;
/* A limit on a human's thinking rather than a step of the game, which is why
   it is not a tick: see the laydown case above. */
export const LAYDOWN_TURN_MS = 60_000;
export const POP_MS = 1600;
