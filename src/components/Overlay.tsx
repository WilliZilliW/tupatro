import type { ReactNode } from "react";

/* Overlay is for the views that do not need your hand: blind select, the
   shop, the rules, the results. Decision panels do not use it — see
   DeclPanel. */
export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="overlay">
      <div className="panel">{children}</div>
    </div>
  );
}
