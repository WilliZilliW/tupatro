import { useGameState } from "../../hooks/useGame";
import { BlindSelect } from "./BlindSelect";
import { CashOut } from "./CashOut";
import { ChallengeOver } from "./ChallengeOver";
import { Challenges } from "./Challenges";
import { DealEnd } from "./DealEnd";
import { GameOver } from "./GameOver";
import { Lobby } from "./Lobby";
import { Menu } from "./Menu";
import { RestartConfirm } from "./RestartConfirm";
import { Rules } from "./Rules";
import { ScoresModal } from "./ScoresModal";
import { SeedDialog } from "./SeedDialog";
import { Shop } from "./Shop";
import { Victory } from "./Victory";

/* The overlay views, drawn modal -> menu -> screen. A modal the player opened
   themselves (rules, seed, restart, scores) sits on top of both the start menu
   and the flow-driven view and closes back to whichever was underneath — which
   is why the three are separate fields. */
export function Screens() {
  const { screen, menu, modal } = useGameState();

  if (modal === "rules") return <Rules />;
  if (modal === "seed") return <SeedDialog />;
  if (modal === "restart") return <RestartConfirm />;
  if (modal === "scores") return <ScoresModal />;

  if (menu === "start") return <Menu />;
  if (menu === "challenges") return <Challenges />;
  /* Two doors into one room: the host sets the table, a guest pastes an
     invitation. New Game reaches neither — a single-player run starts at seat
     0 on the spot, and a player who cannot have company is handed no decision
     at all. */
  if (menu === "lobby") return <Lobby />;
  if (menu === "join") return <Lobby joining />;

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
    case "challengeover":
      return <ChallengeOver score={screen.score} />;
  }
}
