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

   Two buttons deliberately stay ordinary `<button>`s: Rules and SCORES. Both
   are `local` actions and somebody at the shared screen looking a rule up is
   exactly what the panel is for. */
export function MoveButton(props: ComponentProps<"button">) {
  const spectating = useSpectating();
  if (spectating) return null;
  return <button {...props} />;
}
