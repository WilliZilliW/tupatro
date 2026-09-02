import type { ReactNode } from "react";

/* Decision panels are not modal: the declaration, the side-deck swap and the
   sooli card choice draw over the felt, because the player has to see and
   rearrange their own hand while deciding.

   Most important content first: the panel scrolls on a short window and the
   buttons sit in a sticky footer. Test at ~500 px of height too. */
export function DeclPanel({ children }: { children: ReactNode }) {
  return <div id="declpanel">{children}</div>;
}
