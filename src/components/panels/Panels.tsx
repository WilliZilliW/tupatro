import { useGameState } from "../../hooks/useGame";
import { DeclPanel } from "../DeclPanel";
import { DeclarePanel } from "./DeclarePanel";
import { SooliGive } from "./SooliGive";
import { SooliOffer } from "./SooliOffer";
import { SooliReady } from "./SooliReady";
import { SwapPanel } from "./SwapPanel";

/* The decision panel for the current phase. These are not modal: your own
   hand stays visible and rearrangeable while you decide. */
export function Panels() {
  const { phase, declSeq, declIdx } = useGameState();

  if (phase === "swap")
    return (
      <DeclPanel>
        <SwapPanel />
      </DeclPanel>
    );
  /* The opponents' declarations need no panel — only your own turn does. */
  if (phase === "declare" && declSeq[declIdx] === 0)
    return (
      <DeclPanel>
        <DeclarePanel />
      </DeclPanel>
    );
  if (phase === "soolioffer")
    return (
      <DeclPanel>
        <SooliOffer />
      </DeclPanel>
    );
  if (phase === "sooligive")
    return (
      <DeclPanel>
        <SooliGive />
      </DeclPanel>
    );
  if (phase === "sooliready")
    return (
      <DeclPanel>
        <SooliReady />
      </DeclPanel>
    );
  return null;
}
