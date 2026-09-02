import { aiDeclare, chooseAI } from "./ai.js";
import { cardName, makeDeck, mkCard } from "./cards.js";
import { ANTES, BLIND_MULT, SEATS, SM, isUs } from "./constants.js";
import { BOSSES } from "./content.js";
import { rnd, shuffle } from "./rng.js";
import { currentWinner, nextSeat, scoresForUs, trickSize } from "./rules.js";
import { finalScore, scoreTrick } from "./scoring.js";
import { G, animatedIds, applySort, later, newGame, sortHand } from "./state.js";
import { closeDeclPanel, closeOverlay, declPanel, toast } from "./ui/dom.js";
import { cardHTML, render, showPop } from "./ui/render.js";
import {
  askDeclaration,
  offerSooli,
  renderSwapPanel,
  showBlindSelect,
  showCashOut,
  showDealEnd,
  showGameOver,
  showVictory,
} from "./ui/screens.js";

/* ============================ jako ============================ */
export function deal() {
  const d = shuffle(makeDeck());
  G.hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) G.hands[i % 4].push(d[i]);
  for (let p = 1; p < 4; p++) sortHand(G, p);
  G.customOrder = false;
  applySort(G);
  G.trick = [];
  G.trickNo = 0;
  animatedIds.clear();
}

/* Uusi ajo: tila puhtaaksi ja näkymä auki. state.js ei tunne käyttöliittymää,
   joten UI-kutsut asuvat täällä. */
export function startRun(seed) {
  newGame(seed);
  render();
  showBlindSelect();
}

export function startBlind() {
  const bi = G.blindIdx;
  G.boss = bi === 2 ? BOSSES[Math.floor(rnd() * BOSSES.length)] : null;
  G.target = Math.round(ANTES[G.ante - 1] * BLIND_MULT[bi]);
  G.blindScore = 0;
  G.dealsLeft = G.deals;
  startDeal();
}

/* Yksi panos = useampi tuppijako, kuten tupissa pisteitä kerätään jako kerrallaan. */

/* Yksi panos = useampi tuppijako, kuten tupissa pisteitä kerätään jako kerrallaan. */
export function startDeal() {
  G.usTricks = 0;
  G.themTricks = 0;
  G.scored = 0;
  G.base = 0;
  G.reveal = false;
  G.steal = false;
  G.sooli = false;
  G.sooliOrder = null;
  G.sooliBust = false;
  G.mode = null;
  G.ramSeat = null;
  G.ramTeam = null;
  G.shows = [null, null, null, null];
  deal();
  G.swapsLeft = G.swaps;
  G.swapPick = null;
  G.usedSide = [];
  closeDeclPanel();
  closeOverlay();
  if (G.sideDeck.length && G.swapsLeft > 0) {
    G.phase = "swap";
    render();
    renderSwapPanel();
  } else runDeclarations();
}

/* --- tuppipakka: vaihda kortteja käteen ennen näyttöä --- */

export function doSwap(handCard) {
  const src = G.swapPick;
  if (!src) {
    toast("Valitse ensin kortti tuppipakasta.");
    return;
  }
  if (G.swapsLeft <= 0) {
    toast("Vaihdot käytetty.");
    return;
  }
  const i = G.hands[0].findIndex((c) => c.uid === handCard.uid);
  if (i < 0) return;
  const copy = mkCard(src.s, src.r, src.enh);
  copy.srcUid = src.uid;
  G.hands[0].splice(i, 1, copy);
  G.swapsLeft--;
  G.usedSide.push(src.uid);
  G.swapPick = null;
  applySort(G);
  toast(cardName(handCard) + " → " + cardName(copy));
  render();
  renderSwapPanel();
}

/* ==================== näyttö: rami vai nolo ==================== */
/* Tuppi: etukäsi (jakajan vasen) näyttää ensin, sitten myötäpäivään.
   Punainen kortti = rami, musta = nolo, ei kuvakortteja eikä ässää.
   Ramia pelataan, jos yksikin näyttää sitä. */

export function declOrder() {
  const o = [];
  for (let i = 0; i < 4; i++) o.push((G.dealer + 1 + i) % 4);
  return o;
}

export function showCardFor(p, decl) {
  const wantRed = decl === "rami";
  const cand = G.hands[p].filter((c) => c.r >= 2 && c.r <= 10 && SM[c.s].red === wantRed);
  return cand.length ? cand[Math.floor(rnd() * cand.length)] : null;
}

export function runDeclarations() {
  G.phase = "declare";
  G.declSeq = declOrder();
  G.declIdx = 0;
  render();
  stepDeclare();
}

export function stepDeclare() {
  if (G.declIdx >= 4) {
    finishDeclare();
    return;
  }
  const p = G.declSeq[G.declIdx];
  if (p === 0) {
    askDeclaration();
    return;
  }
  const d = aiDeclare(G, p);
  G.shows[p] = { decl: d, card: showCardFor(p, d) };
  G.declIdx++;
  render();
  later(stepDeclare, 620);
}

/* Näyttö tehdään filtin päällä olevassa paneelissa, jotta oma käsi jää näkyviin
   ja järjesteltäväksi päätöksen ajaksi. */

export function finishDeclare() {
  const first = G.declSeq.find((p) => G.shows[p] && G.shows[p].decl === "rami");
  if (first === undefined) {
    G.mode = "nolo";
    G.ramSeat = null;
    G.ramTeam = null;
    G.leader = (G.dealer + 1) % 4; /* nolossa etukäsi ajaa */
  } else {
    G.mode = "rami";
    G.ramSeat = first;
    G.ramTeam = isUs(first) ? 0 : 1;
    G.leader = (first + 3) % 4; /* ramaajan oikea puoli ajaa */
  }
  G.turn = G.leader;
  /* Sooli: vain kun vastustajat ramaavat. */
  if (G.mode === "rami" && G.ramTeam === 1) offerSooli();
  else beginPlay();
}

export function beginPlay() {
  G.phase = "play";
  closeDeclPanel();
  closeOverlay();
  render();
  if (G.turn !== 0) scheduleAI(760);
}

/* ============================ sooli ============================ */
/* Soolissa ässä on pienin, joten vaaralliset kortit ovat 10..K. */

/* Soolissa ässä on pienin, joten vaaralliset kortit ovat 10..K. */
export function sooliRisk() {
  const h = G.hands[0];
  const high = h.filter((c) => c.r >= 10 && c.r <= 13).length;
  const bySuit = {};
  h.forEach((c) => (bySuit[c.s] = bySuit[c.s] || []).push(c));
  let lowGuards = 0;
  for (const k in bySuit) if (bySuit[k].some((c) => c.r === 14 || c.r <= 3)) lowGuards++;
  const verdict =
    high <= 2
      ? "paras mahdollinen — noin joka viides onnistuu"
      : high <= 4
        ? "heikko — onnistuu harvoin"
        : "lähes toivoton";
  return { high, lowGuards, verdict };
}

/* Tuppi: soolaaja antaa parilleen yhden kortin ja saa yhden tilalle sokkona.
   Annettava kortti on soolaajan valinta, ei pelin. */
export function beginSooliGive() {
  G.sooli = true; /* ässä on tästä eteenpäin pienin */
  G.phase = "sooligive";
  render();
  declPanel(
    "<h3>Anna Veikolle yksi kortti</h3>" +
      '<div class="ln"><span>Valitse kortti kädestäsi</span><b>saat yhden tilalle sokkona</b></div>' +
      '<p class="fine">Soolissa <b>ässä on pienin</b> kortti, joten korkeat kuvakortit ovat vaarallisimmat — ' +
      "niillä joutuu viemään tikin. Et näe mitä Veikolta tulee tilalle. " +
      "Kätesi on alla, järjestele se vapaasti.</p>",
    () => {},
  );
}

export function doSooliGive(give) {
  const i = G.hands[0].findIndex((c) => c.uid === give.uid);
  if (i < 0) return;
  const mate = G.hands[2];
  if (!mate.length) return;
  const get = mate[Math.floor(rnd() * mate.length)];
  G.hands[0].splice(i, 1);
  mate.splice(
    mate.findIndex((c) => c.uid === get.uid),
    1,
  );
  G.hands[0].push(get);
  applySort(G);
  G.hands[2] = []; /* pari ei pelaa */
  const other = G.ramSeat === 1 ? 3 : 1;
  G.sooliOrder = [G.ramSeat, other, 0]; /* soolaaja viimeisenä */
  G.leader = G.ramSeat;
  G.turn = G.ramSeat;
  G.phase = "sooliready";
  render();
  const risk = sooliRisk();
  declPanel(
    "<h3>Vaihto tehty</h3>" +
      '<div class="sidedeck">' +
      cardHTML(give, "mini") +
      '<div style="align-self:center;font-family:var(--font-m);color:#8FA89A">→</div>' +
      cardHTML(get, "mini") +
      "</div>" +
      '<div class="ln"><span>Annoit</span><b>' +
      cardName(give) +
      "</b></div>" +
      '<div class="ln"><span>Sait</span><b>' +
      cardName(get) +
      "</b></div>" +
      '<div class="ln"><span>Käden sooliarvio nyt</span><b>' +
      risk.verdict +
      "</b></div>" +
      '<p class="fine">' +
      SEATS[G.ramSeat].name +
      " aloittaa. Sinä pelaat aina viimeisenä, " +
      "eikä yhtäkään tikkiä saa jäädä sinulle.</p>" +
      '<div class="row"><button class="btn" data-go>Aloita sooli</button></div>',
    (el) =>
      (el.querySelector("[data-go]").onclick = () => {
        closeDeclPanel();
        beginPlay();
      }),
  );
}

/* ============================ pelilogiikka ============================ */

export function playCard(p, card) {
  const h = G.hands[p];
  const i = h.findIndex((c) => c.uid === card.uid);
  if (i < 0) return;
  h.splice(i, 1);
  G.trick.push({ p, card });
  if (G.trick.length === trickSize(G)) {
    G.phase = "resolve";
    render();
    later(resolveTrick, 760);
  } else {
    G.turn = nextSeat(G, G.turn);
    render();
    if (G.turn !== 0) scheduleAI(560);
  }
}

export function scheduleAI(delay) {
  later(() => {
    if (G.phase !== "play") return;
    playCard(G.turn, chooseAI(G, G.turn));
  }, delay);
}

export function resolveTrick() {
  let w = currentWinner(G);
  if (G.steal) {
    const wantMine = G.mode === "rami" && !G.sooli;
    const mine = G.trick.find((t) => t.p === 0);
    const notMine = G.trick.find((t) => t.p !== 0);
    if (wantMine && mine) w = mine;
    else if (!wantMine && notMine) w = notMine;
    G.steal = false;
  }
  const cards = G.trick.map((t) => t.card);
  const leadSeat = G.trick[0].p;
  G.winSeat = w.p;

  if (isUs(w.p)) G.usTricks++;
  else G.themTricks++;
  if (G.sooli && w.p === 0) G.sooliBust = true;

  let pop = null;
  if (scoresForUs(G, w.p) && !G.sooliBust) {
    pop = scoreTrick(G, w.p, leadSeat, cards);
    G.base += pop.total;
    G.scored++;
    showPop(pop);
    /* lasikortti voi särkyä pysyvästi tuppipakasta */
    for (const c of cards) {
      if (c.enh !== "glass" || !c.srcUid) continue;
      if (rnd() >= 0.25) continue;
      const i = G.sideDeck.findIndex((x) => x.uid === c.srcUid);
      if (i >= 0) {
        G.sideDeck.splice(i, 1);
        toast("Lasikortti " + cardName(c) + " särkyi.");
      }
    }
  }
  render();

  later(
    () => {
      G.winSeat = null;
      G.trick = [];
      G.trickNo++;
      if (G.sooliBust) {
        endHand();
        return;
      }
      if (G.trickNo >= 13) {
        endHand();
        return;
      }
      G.leader = w.p;
      G.turn = w.p;
      if (G.sooli) {
        /* soolaaja pelaa aina viimeisenä */
        const other = G.sooliOrder.filter((x) => x !== 0 && x !== w.p)[0];
        G.sooliOrder = [w.p, other, 0];
        G.turn = w.p;
      }
      G.phase = "play";
      render();
      if (G.turn !== 0) scheduleAI(600);
    },
    pop ? 1250 : 650,
  );
}

export function endHand() {
  G.phase = "handend";
  const sc = finalScore(G);
  G.blindScore += sc;
  G.dealsLeft--;
  render();
  later(() => {
    if (G.blindScore >= G.target) showCashOut(sc);
    else if (G.dealsLeft <= 0) showGameOver();
    else showDealEnd(sc);
  }, 500);
}

export function nextBlind() {
  G.beaten[G.blindIdx] = true;
  if (G.blindIdx === 2) {
    if (G.ante >= 8) {
      showVictory();
      return;
    }
    G.ante++;
    G.blindIdx = 0;
    G.beaten = [false, false, false];
  } else G.blindIdx++;
  G.dealer = (G.dealer + 1) % 4;
  G.phase = "blindselect";
  showBlindSelect();
  render();
}

/* ============================ temput ============================ */

/* ============================ temput ============================ */
export function useConsumable(i) {
  const c = G.consumables[i];
  if (!c) return;
  if (G.phase !== "play") {
    toast("Odota että jako on käynnissä.");
    return;
  }
  if ((c.id === "uusijako" || c.id === "kannanvaihto") && G.trickNo > 0) {
    toast(c.n + " onnistuu vain ennen ensimmäistä tikkiä.");
    return;
  }
  if (c.id === "kannanvaihto" && G.sooli) {
    toast("Soolin aikana ei vaihdeta kantaa.");
    return;
  }
  G.consumables.splice(i, 1);

  if (c.id === "kurkistus") {
    G.reveal = true;
    toast("Kurkistit: kaikki kädet näkyvissä.");
  }
  if (c.id === "tikkivarkaus") {
    G.steal = true;
    toast("Seuraava tikki ohjataan sinulle sopivasti.");
  }
  if (c.id === "kannanvaihto") {
    if (G.mode === "rami") {
      G.mode = "nolo";
      G.ramSeat = null;
      G.ramTeam = null;
      toast("Jaosta tuli nolo.");
    } else {
      G.mode = "rami";
      G.ramSeat = 0;
      G.ramTeam = 0;
      toast("Jaosta tuli rami — sinä ramaat.");
    }
  }
  if (c.id === "vaihtokauppa") {
    const mine = G.hands[0],
      mate = G.hands[2];
    if (mine.length && mate.length) {
      const worst =
        G.mode === "nolo"
          ? mine.slice().sort((a, b) => b.r - a.r)[0] /* nolossa korkein on huonoin */
          : mine.slice().sort((a, b) => a.r - b.r)[0];
      const best =
        G.mode === "nolo"
          ? mate.slice().sort((a, b) => a.r - b.r)[0]
          : mate.slice().sort((a, b) => b.r - a.r)[0];
      mine.splice(
        mine.findIndex((c2) => c2.uid === worst.uid),
        1,
      );
      mate.splice(
        mate.findIndex((c2) => c2.uid === best.uid),
        1,
      );
      mine.push(best);
      mate.push(worst);
      applySort(G);
      sortHand(G, 2);
      toast("Vaihdoit " + cardName(worst) + " → " + cardName(best));
    }
  }
  if (c.id === "uusijako") {
    const d = G.dealer;
    deal();
    G.dealer = d;
    G.turn = G.leader;
    toast("Kortit jaettiin uudelleen.");
    render();
    if (G.turn !== 0) scheduleAI(700);
    return;
  }
  render();
}

/* ============================ renderöinti ============================ */

export function bestAnte() {
  try {
    return parseInt(localStorage.getItem("tupatro-best") || "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(a) {
  try {
    if (a > bestAnte()) localStorage.setItem("tupatro-best", String(a));
  } catch {}
}
