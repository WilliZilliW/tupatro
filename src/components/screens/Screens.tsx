import { useGameState } from "../../hooks/useGame";
import { BlindSelect } from "./BlindSelect";
import { CashOut } from "./CashOut";
import { ChallengeOver } from "./ChallengeOver";
import { Challenges } from "./Challenges";
import { DealEnd } from "./DealEnd";
import { GameOver } from "./GameOver";
import { Lobby } from "./Lobby";
import { Menu } from "./Menu";
import { RaceOver } from "./RaceOver";
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
  /* Two ways into one room: New game sets the table — four chairs and a mode,
     the solo roguelike included — and Join a game enters somebody else's. No
     door in between, because "are you playing alone?" is not a question the
     start menu asks any more; the chairs are the answer. */
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
    case "raceover":
      return <RaceOver screen={screen} />;
  }
}
