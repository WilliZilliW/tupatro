import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { DeclPanel } from "../DeclPanel";
import { DeclarePanel } from "./DeclarePanel";
import { LaydownPanel } from "./LaydownPanel";
import { SooliGive } from "./SooliGive";
import { SooliOffer } from "./SooliOffer";
import { SooliReady } from "./SooliReady";
import { SwapPanel } from "./SwapPanel";

/* The decision panel for the current phase. These are not modal: your own
   hand stays visible and rearrangeable while you decide. */
export function Panels() {
  const { phase, declSeq, declIdx, layNo } = useGameState();
  const you = useViewSeat();

  /* Keyed on the turn, so a new turn remounts the panel with it — the
     workspace is component state and must not survive the turn that built
     it. */
  if (phase === "laydown")
    return (
      <DeclPanel>
        <LaydownPanel key={layNo} />
      </DeclPanel>
    );
  if (phase === "swap")
    return (
      <DeclPanel>
        <SwapPanel />
      </DeclPanel>
    );
  /* The opponents' declarations need no panel — only your own turn does. */
  if (phase === "declare" && declSeq[declIdx] === you)
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
