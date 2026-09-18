import { useGameState } from "../../hooks/useGame";
import { BlindSelect } from "./BlindSelect";
import { CashOut } from "./CashOut";
import { ChallengeOver } from "./ChallengeOver";
import { DealEnd } from "./DealEnd";
import { GameOver } from "./GameOver";
import { HangUpConfirm } from "./HangUpConfirm";
import { Lobby } from "./Lobby";
import { Menu } from "./Menu";
import { RaceOver } from "./RaceOver";
import { RestartConfirm } from "./RestartConfirm";
import { RpsOver } from "./RpsOver";
import { Rules } from "./Rules";
import { ScoresModal } from "./ScoresModal";
import { SeedDialog } from "./SeedDialog";
import { Shop } from "./Shop";
import { SinglePlayer } from "./SinglePlayer";
import { Victory } from "./Victory";

/* The overlay views, drawn modal -> menu -> screen. A modal the player opened
   themselves (rules, seed, restart, scores, hangup) sits on top of both the
   start menu and the flow-driven view and closes back to whichever was
   underneath — which is why the three are separate fields. */
export function Screens() {
  const { screen, menu, modal } = useGameState();

  if (modal === "rules") return <Rules />;
  if (modal === "seed") return <SeedDialog />;
  if (modal === "restart") return <RestartConfirm />;
  if (modal === "scores") return <ScoresModal />;
  if (modal === "hangup") return <HangUpConfirm />;

  if (menu === "start") return <Menu />;
  /* The menu's two doors. Single player is everything played against the game;
     the lobby is the whole of playing with other people, both ways into a
     session included — the room, the code swap and joining either of them are
     its own views, reached by its own buttons, and a #j= link lands on the
     swap's page by reading the hash rather than by a third menu view. */
  if (menu === "single") return <SinglePlayer />;
  if (menu === "lobby") return <Lobby />;

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
    case "rpsover":
      return <RpsOver screen={screen} />;
  }
}
