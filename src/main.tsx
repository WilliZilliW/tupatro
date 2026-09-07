import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { GameProvider } from "./hooks/GameContext";
import { SeatProvider } from "./hooks/SeatProvider";
import { LocaleProvider } from "./i18n/LocaleProvider";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <SeatProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </SeatProvider>
    </LocaleProvider>
  </StrictMode>,
);
