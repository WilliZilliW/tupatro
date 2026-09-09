import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
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
  const { phase, declSeq, declIdx, layNo, challenge, sooliSeat, seats } = useGameState();
  const you = useViewSeat();
  const spectating = useSpectating();

  /* Every panel is one seat's decision, and the shared table holds no seat:
     one return covers all six phases, so a phase added later cannot arrive
     with a live button on a board nobody is playing from. */
  if (spectating) return null;

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
  /* Match offers move between defenders; a fixed peer must never see the
     other chair's choice or private exchange, including an AI's turn. */
  if (
    (challenge === "race" || challenge === "tuppi") &&
    (sooliSeat !== you || seats[you] !== "human")
  )
    return null;
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
