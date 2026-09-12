import { useSpectating } from "../hooks/useNet";
import type { ComponentProps } from "react";

/* A button that would move the game: a `seat` action, a `flow` action, or the
   menu those are started from.

   The shared table draws none of them. It holds no chair, `guestSession` drops
   everything it tries to send and `guestMay` refuses it at the host's door, so
   a button left on the screen would be a control that lies — clicked, watched,
   and nothing happens. One component rather than a `spectating &&` at each
   site, so a screen added later is read-only on the table by writing its
   buttons the ordinary way.

   Those two other layers cover every action but one, and the exception is why
   this one cannot be treated as belt and braces: `leaveChallenge` is `local`,
   and `guestSession.intent` applies a `local` intent *before* it drops a
   table's sends — nothing is sent, so `guestMay` is never asked. A table that
   reached the two result screens' Back to your run would leave the match into
   a run of its own and go on applying the host's numbered actions against it,
   silently, since `hashing.due` is set by `endTrick` alone. This check is the
   whole of what stops it, and render.test.tsx asserts both screens by name
   because the table sweep's `onlyLocal` filter no longer sees the action.

   Two buttons deliberately stay ordinary `<button>`s: Rules and SCORES. Both
   are `local` actions and somebody at the shared screen looking a rule up is
   exactly what the panel is for. */
export function MoveButton(props: ComponentProps<"button">) {
  const spectating = useSpectating();
  if (spectating) return null;
  return <button {...props} />;
}
