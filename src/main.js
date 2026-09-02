import { deal, doSooliGive, doSwap, playCard, sooliRisk, startBlind, startRun } from "./flow.js";
import { G, newGame } from "./state.js";
import { detectLocale, setLocale, getLocale, t } from "./i18n.js";
import { isStone, isWild, matchesSuit, rv } from "./cards.js";
import { currentWinner, leadSuit, legalCards } from "./rules.js";
import { finalScore, scoreTrick, tuppiInfo, tuppiMult } from "./scoring.js";
import { handPower } from "./ai.js";
import { setSeed } from "./rng.js";
import { rollShop } from "./shop.js";
import { closeOverlay, overlay } from "./ui/dom.js";
import { render } from "./ui/render.js";
import { showBlindSelect, showRules, showSeedDialog, showShop } from "./ui/screens.js";

/* Käynnistys ja tapahtumien kytkentä. Tämä on ainoa moduuli jolla on
   sivuvaikutuksia latautuessaan. */
document.getElementById("btnrules").onclick = showRules;
document.getElementById("seedchip").onclick = showSeedDialog;
document.getElementById("langbtn").onclick = () => {
  setLocale(getLocale() === "fi" ? "en" : "fi");
  /* Koko käyttöliittymä piirretään uudelleen; avoin näkymä palautetaan. */
  render();
  if (G.phase === "blindselect") showBlindSelect();
  else if (G.phase === "shop") showShop();
};
document.getElementById("btnnew").onclick = () => {
  if (G && G.phase === "play" && G.trickNo > 0) {
    overlay(
      "<h2>" +
        t("restart.title") +
        '</h2><p class="dek">' +
        t("restart.body") +
        "</p>" +
        '<div class="row"><button class="btn" data-y>' +
        t("btn.yesRestart") +
        "</button>" +
        '<button class="btn ghost" data-n>' +
        t("btn.continue") +
        "</button></div>",
      (el) => {
        el.querySelector("[data-y]").onclick = () => setLocale(detectLocale());
        startRun();
        el.querySelector("[data-n]").onclick = () => {
          closeOverlay();
          render();
        };
      },
    );
  } else startRun();
};
startRun();

/* Tarkoituksellinen konsolipinta tasapainosimulointiin ja selaintestaukseen.
   Moduulit ovat IIFE:n sisällä, joten mitään ei valu globaaliksi vahingossa.
   Käyttö ja kuvio: ks. CLAUDE.md, "Balance is measured in the browser". */
window.tupatro = {
  get G() {
    return G;
  },
  newGame,
  startRun,
  startBlind,
  deal,
  setSeed,
  rollShop,
  playCard,
  doSwap,
  doSooliGive,
  legalCards,
  leadSuit,
  currentWinner,
  matchesSuit,
  isStone,
  isWild,
  rv,
  handPower,
  sooliRisk,
  scoreTrick,
  tuppiInfo,
  tuppiMult,
  finalScore,
};
