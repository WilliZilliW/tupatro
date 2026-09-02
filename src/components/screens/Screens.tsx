import { useGameState } from "../../hooks/useGame";
import { BlindSelect } from "./BlindSelect";
import { CashOut } from "./CashOut";
import { DealEnd } from "./DealEnd";
import { GameOver } from "./GameOver";
import { RestartConfirm } from "./RestartConfirm";
import { Rules } from "./Rules";
import { SeedDialog } from "./SeedDialog";
import { Shop } from "./Shop";
import { Victory } from "./Victory";

/* The overlay views. A modal the player opened themselves (rules, seed,
   restart) sits on top of the flow-driven view and closes back to it — hence
   the two fields. */
export function Screens() {
  const { screen, modal } = useGameState();

  if (modal === "rules") return <Rules />;
  if (modal === "seed") return <SeedDialog />;
  if (modal === "restart") return <RestartConfirm />;

  if (!screen) return null;
  switch (screen.kind) {
    case "blindselect":
      return <BlindSelect />;
    case "shop":
      return <Shop />;
    case "dealend":
      return <DealEnd score={screen.score} />;
    case "cashout":
      return <CashOut screen={screen} />;
    case "gameover":
      return <GameOver />;
    case "victory":
      return <Victory />;
  }
}
