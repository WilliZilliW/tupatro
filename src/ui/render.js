import { cardName, chipValue, enhOf, isStone, rv } from "../cards.js";
import { BLIND_NAME, SEATS, SM, rankLabel } from "../constants.js";
import { ENH } from "../content.js";
import { doSooliGive, doSwap, playCard, useConsumable } from "../flow.js";
import { leadSuit, legalCards } from "../rules.js";
import { finalScore, tuppiInfo } from "../scoring.js";
import { sellJoker, sellSideCard } from "../shop.js";
import { G, animatedIds, applySort, later } from "../state.js";
import { toast } from "./dom.js";

/* ============================ renderöinti ============================ */
export function cardHTML(c, cls) {
  if (isStone(c))
    return (
      '<div class="' +
      ["card", "e-stone", cls || ""].join(" ") +
      '" title="Kivikortti">' +
      '<span class="big">◼</span><span class="chip">+' +
      chipValue(G, c) +
      "</span></div>"
    );
  const m = SM[c.s],
    e = enhOf(c);
  return (
    '<div class="' +
    ["card", m.red ? "red" : "", c.enh ? "e-" + c.enh : "", cls || ""].join(" ") +
    '"' +
    (e ? ' title="' + e.n + '"' : "") +
    ">" +
    '<span class="r">' +
    rankLabel(c.r) +
    "</span>" +
    '<span class="sm">' +
    m.g +
    "</span>" +
    '<span class="big">' +
    m.g +
    "</span>" +
    (e ? '<span class="ebadge">' + e.g + "</span>" : "") +
    '<span class="chip">+' +
    chipValue(G, c) +
    "</span></div>"
  );
}

export function render() {
  renderRail();
  renderTable();
  renderHand();
}

export function renderRail() {
  document.getElementById("antelbl").textContent = "Panos " + G.ante + "/8";
  document.getElementById("seedchip").innerHTML = "Siemen <b>" + G.seed + "</b>";
  const bi = G.blindIdx,
    boss = G.boss;
  document.getElementById("blindbox").innerHTML =
    '<div class="blindplate"><div class="blindmark bm-' +
    bi +
    '">' +
    (bi === 2 ? "☠" : bi === 1 ? "◉" : "●") +
    "</div><div>" +
    '<div class="lbl">' +
    (bi === 2 ? "Pomo" : "Panos " + (bi + 1)) +
    "</div>" +
    '<div class="blindname">' +
    (boss ? boss.n : BLIND_NAME[bi]) +
    "</div></div></div>" +
    (boss ? '<div class="bossnote">' + boss.t + "</div>" : "");

  const info = tuppiInfo(G),
    sc = finalScore(G);
  /* Jaon pisteet lisätään blindScoreen vasta endHandissa — älä laske niitä kahdesti. */
  const live = G.phase === "declare" || G.phase === "play" || G.phase === "resolve";
  const tot = G.blindScore + (live ? sc : 0);
  const pct = Math.min(100, G.target ? (tot / G.target) * 100 : 0);
  document.getElementById("slate").innerHTML =
    '<div class="lbl">Panoksen pisteet</div>' +
    '<div class="scorebig">' +
    tot.toLocaleString("fi-FI") +
    "</div>" +
    '<div class="scoresub">tavoite ' +
    G.target.toLocaleString("fi-FI") +
    "</div>" +
    '<div class="bar' +
    (G.target && tot >= G.target ? " done" : "") +
    '"><i style="width:' +
    pct +
    '%"></i></div>' +
    '<div class="formula"><span class="lbl" style="letter-spacing:.1em">Tämä jako</span>' +
    '<span class="pill c">' +
    G.base.toLocaleString("fi-FI") +
    "</span>" +
    '<span class="pill ' +
    (info.mult ? "t" : "dead") +
    '">×' +
    info.mult +
    "</span>" +
    '<span class="times">=</span><span class="pill ' +
    (sc ? "t" : "dead") +
    '">' +
    sc.toLocaleString("fi-FI") +
    "</span></div>" +
    (G.mode
      ? '<div class="needline ' + (info.ok ? "ok" : "warn") + '">' + info.need + "</div>"
      : "");

  const marks = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) s += '<b class="' + ((i + 1) % 5 === 0 ? "five" : "") + '">|</b>';
    return s || '<b style="opacity:.2">–</b>';
  };
  document.getElementById("tallybox").innerHTML =
    '<div class="tallies">' +
    '<div class="tally"><div class="lbl">Me</div><div class="tallymark">' +
    marks(G.usTricks) +
    "</div>" +
    '<div class="tallynum">' +
    G.usTricks +
    " tikkiä</div></div>" +
    '<div class="tally them"><div class="lbl">He</div><div class="tallymark">' +
    marks(G.themTricks) +
    "</div>" +
    '<div class="tallynum">' +
    G.themTricks +
    " tikkiä</div></div></div>";

  document.getElementById("stats").innerHTML =
    '<div class="stat money"><div class="lbl">Rahaa</div><div class="v">$' +
    G.money +
    "</div></div>" +
    '<div class="stat"><div class="lbl">Tikki</div><div class="v">' +
    Math.min(13, G.trickNo + 1) +
    "/13</div></div>" +
    '<div class="stat"><div class="lbl">Jakoja</div><div class="v">' +
    G.dealsLeft +
    "</div></div>";

  document.getElementById("jklbl").textContent = "Jokerit " + G.jokers.length + "/" + G.jokerSlots;
  document.getElementById("jokers").innerHTML = G.jokers.length
    ? G.jokers
        .map(
          (j, i) =>
            '<div class="jk r-' +
            j.r +
            '"><div class="glyph">' +
            j.g +
            "</div><div>" +
            '<div class="nm">' +
            j.n +
            (j.mode ? '<span class="tag ' + j.mode + '">' + j.mode.toUpperCase() + "</span>" : "") +
            "</div>" +
            '<div class="tx">' +
            j.t +
            "</div></div>" +
            '<button class="sell" data-sell="' +
            i +
            '" title="Myy">$' +
            Math.max(1, Math.ceil(j.p / 2)) +
            "</button></div>",
        )
        .join("")
    : '<div class="empty">Ei jokereita. Kauppa aukeaa panoksen jälkeen.</div>';
  document
    .querySelectorAll("[data-sell]")
    .forEach((b) => (b.onclick = () => sellJoker(parseInt(b.dataset.sell, 10))));

  const sb = document.getElementById("sidebox");
  sb.innerHTML =
    '<div class="lbl" style="margin-bottom:5px">Tuppipakka ' +
    G.sideDeck.length +
    "/" +
    G.sideSlots +
    (G.phase === "swap" ? " · vaihtoja " + G.swapsLeft : "") +
    "</div>" +
    (G.sideDeck.length
      ? '<div class="sidelist">' +
        G.sideDeck
          .map(
            (c, i) =>
              '<div class="sideitem">' +
              cardHTML(c, "mini") +
              '<button class="sell" data-sidesell="' +
              i +
              '" title="Myy">$' +
              Math.max(1, Math.ceil((ENH[c.enh] ? ENH[c.enh].p : 3) / 2)) +
              "</button></div>",
          )
          .join("") +
        "</div>"
      : '<div class="empty">Tyhjä. Kauppa myy jalostettuja kortteja.</div>');
  sb.querySelectorAll("[data-sidesell]").forEach(
    (b) => (b.onclick = () => sellSideCard(parseInt(b.dataset.sidesell, 10))),
  );

  const cb = document.getElementById("consbox");
  cb.innerHTML =
    '<div class="lbl" style="margin-bottom:5px">Temput ' +
    G.consumables.length +
    "/" +
    G.consSlots +
    "</div>" +
    (G.consumables.length
      ? '<div class="cons">' +
        G.consumables
          .map(
            (c, i) =>
              '<button class="consbtn" data-use="' +
              i +
              '"><div class="nm">' +
              c.n +
              '</div><div class="tx">' +
              c.t +
              "</div></button>",
          )
          .join("") +
        "</div>"
      : '<div class="empty">Ei temppuja kädessä.</div>');
  cb.querySelectorAll("[data-use]").forEach(
    (b) => (b.onclick = () => useConsumable(parseInt(b.dataset.use, 10))),
  );
}

export function renderTable() {
  const felt = document.getElementById("felt");
  Array.from(felt.querySelectorAll(".seat,.slot,.pop")).forEach((n) => n.remove());
  const pos = ["s", "w", "n", "e"];

  for (let p = 0; p < 4; p++) {
    const sitOut = G.sooli && p === 2;
    const d = document.createElement("div");
    d.className =
      "seat seat-" +
      pos[p] +
      (p === 0 ? " us" : p === 2 ? " mate" : "") +
      (G.turn === p && G.phase === "play" ? " active" : "") +
      (sitOut ? " out" : "");
    const sh = G.shows[p];
    const info = sitOut
      ? "ei pelaa"
      : G.reveal && p !== 0
        ? G.hands[p]
            .slice()
            .sort((a, b) => rv(G, b) - rv(G, a))
            .map(cardName)
            .join(" ")
        : G.hands[p].length + " korttia";
    d.innerHTML =
      '<div class="av">' +
      SEATS[p].short +
      "</div><div>" +
      '<div class="who">' +
      SEATS[p].name +
      (G.dealer === p ? ' <span class="dealerchip">JAKAJA</span>' : "") +
      (sh
        ? ' <span class="showchip ' +
          sh.decl +
          '">' +
          sh.decl.toUpperCase() +
          (sh.card ? " " + cardName(sh.card) : " (sanoi)") +
          "</span>"
        : "") +
      '</div><div class="sub">' +
      info +
      "</div></div>";
    felt.appendChild(d);
  }

  for (const t of G.trick) {
    const d = document.createElement("div");
    const fresh = !animatedIds.has(t.card.uid);
    if (fresh) animatedIds.add(t.card.uid);
    d.className = "slot slot-" + pos[t.p] + (G.winSeat === t.p ? " win" : "");
    d.innerHTML = cardHTML(t.card, fresh ? "fresh" : "");
    felt.appendChild(d);
  }

  const mb = document.getElementById("modebox");
  if (!G.mode) {
    mb.innerHTML =
      '<div class="lbl">Näyttö</div><div class="val">…</div>' +
      '<div class="note">Punainen = rami, musta = nolo.</div>';
  } else {
    const rob = G.mode === "rami" && G.ramTeam === 1;
    mb.innerHTML =
      '<div class="lbl">Jako</div>' +
      '<div class="val ' +
      G.mode +
      '">' +
      (G.sooli ? "SOOLI" : G.mode.toUpperCase()) +
      "</div>" +
      '<div class="note">' +
      (G.sooli
        ? "Pelaat yksin. Yksikin tikki kaataa soolin."
        : G.mode === "rami"
          ? SEATS[G.ramSeat].name +
            " ramasi. " +
            (rob ? "Te puolustatte — 7 tikkiä on ryöstö." : "Tarvitsette 7 tikkiä.")
          : "Kaikki näyttivät mustaa. Vähemmän tikkejä vienyt pari voittaa.") +
      "</div>";
  }

  const cm = document.getElementById("centermsg");
  cm.textContent =
    G.trick.length || G.phase !== "play"
      ? ""
      : G.turn === 0
        ? "Sinä ajat"
        : SEATS[G.turn].name + " ajaa";
}

export let dragId = null,
  dragMoved = false,
  dragStartX = 0,
  justDragged = false;

/* Korttien raahaus: DOM-solmua siirretään suoraan, taulukko päivitetään vasta lopuksi. */

/* Korttien raahaus: DOM-solmua siirretään suoraan, taulukko päivitetään vasta lopuksi. */
export function initHandDrag(row) {
  row.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragId = el.dataset.id;
      dragMoved = false;
      dragStartX = e.clientX;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    });
    el.addEventListener("pointermove", (e) => {
      if (dragId !== el.dataset.id) return;
      if (!dragMoved && Math.abs(e.clientX - dragStartX) < 8) return;
      dragMoved = true;
      el.classList.add("dragging");
      let placed = false;
      for (const sib of Array.from(row.children)) {
        if (sib === el) continue;
        const r = sib.getBoundingClientRect();
        if (e.clientX < r.left + r.width / 2) {
          row.insertBefore(el, sib);
          placed = true;
          break;
        }
      }
      if (!placed) row.appendChild(el);
    });
    const finish = () => {
      if (dragId !== el.dataset.id) return;
      if (dragMoved) {
        const order = Array.from(row.children).map((x) => x.dataset.id);
        G.hands[0].sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid));
        G.customOrder = true;
        justDragged = true;
        later(() => {
          justDragged = false;
        }, 350);
        renderHand();
      }
      dragId = null;
      dragMoved = false;
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
  });
}

export function renderHandTools() {
  const el = document.getElementById("handtools");
  if (!G.hands[0] || !G.hands[0].length) {
    el.innerHTML = "";
    return;
  }
  const on = (m) => (!G.customOrder && G.sortMode === m ? " on" : "");
  el.innerHTML =
    '<span class="tip">Järjestys</span>' +
    '<button class="sortbtn' +
    on("suit") +
    '" data-sort="suit">Maittain</button>' +
    '<button class="sortbtn' +
    on("rank") +
    '" data-sort="rank">Arvoittain</button>' +
    '<span class="tip">' +
    (G.customOrder ? "oma järjestys" : "raahaa kortteja tai alt + nuoli") +
    "</span>";
  el.querySelectorAll("[data-sort]").forEach(
    (b) =>
      (b.onclick = () => {
        G.sortMode = b.dataset.sort;
        G.customOrder = false;
        applySort(G);
        renderHand();
      }),
  );
}

export function renderHand() {
  const row = document.getElementById("handrow");
  const hand = G.hands[0] || [];
  const legal =
    G.phase === "play" && G.turn === 0 ? new Set(legalCards(G, 0).map((c) => c.uid)) : null;
  const shown = G.shows[0] && G.shows[0].card ? G.shows[0].card.uid : null;
  /* Näyttökierroksella kortit levitetään, jotta koko käsi näkyy kerralla. */
  row.className =
    "handrow" +
    (G.phase === "declare" || G.phase === "swap" || G.phase === "sooligive" ? " spread" : "");
  row.innerHTML = hand
    .map((c) => {
      const ok = legal && legal.has(c.uid);
      const cls = [
        "hcard",
        ok ? "playable" : "",
        legal && !ok ? "dead" : "",
        c.uid === shown ? "shown" : "",
      ].join(" ");
      return cardHTML(c, cls).replace(
        "<div class=",
        '<div tabindex="0" data-id="' + c.uid + '" class=',
      );
    })
    .join("");
  row.querySelectorAll("[data-id]").forEach((el) => {
    const c = hand.find((x) => x.uid === el.dataset.id);
    const act = () => {
      if (justDragged) return;
      if (G.phase === "swap") {
        doSwap(c);
        return;
      }
      if (G.phase === "sooligive") {
        doSooliGive(c);
        return;
      }
      if (G.phase !== "play" || G.turn !== 0) return;
      if (!legalCards(G, 0).some((x) => x.uid === c.uid)) {
        toast("Maantuntopakko: sinun on tunnustettava " + SM[leadSuit(G)].n.toLowerCase() + "a.");
        return;
      }
      playCard(0, c);
    };
    el.onclick = act;
    el.onkeydown = (e) => {
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const h = G.hands[0];
        const i = h.findIndex((x) => x.uid === c.uid);
        const j = e.key === "ArrowLeft" ? i - 1 : i + 1;
        if (j < 0 || j >= h.length) return;
        const t = h[i];
        h[i] = h[j];
        h[j] = t;
        G.customOrder = true;
        renderHand();
        const nel = row.querySelector('[data-id="' + c.uid + '"]');
        if (nel) nel.focus();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        act();
      }
    };
  });
  initHandDrag(row);
  renderHandTools();

  const h = document.getElementById("hint");
  if (G.phase === "play" && G.turn === 0)
    h.textContent = leadSuit(G)
      ? "Tunnusta maata: " +
        SM[leadSuit(G)].n +
        (G.mode === "nolo" ? " · väistä tikki" : " · vie tikki")
      : G.mode === "nolo"
        ? "Sinä ajat — aja matalalla"
        : "Sinä ajat";
  else if (G.phase === "play") h.textContent = SEATS[G.turn].name + " miettii…";
  else if (G.phase === "swap")
    h.textContent = G.swapPick
      ? "Valitse kädestä kortti jonka vaihdat"
      : "Tuppipakka — valitse vaihdettava kortti";
  else if (G.phase === "sooligive") h.textContent = "Sooli — valitse kortti jonka annat Veikolle";
  else if (G.phase === "sooliready") h.textContent = "Sooli alkaa";
  else if (G.phase === "declare") h.textContent = "Näyttökierros — järjestele käsi vapaasti";
  else h.textContent = "";
}

export function showPop(ctx) {
  const felt = document.getElementById("felt");
  const d = document.createElement("div");
  d.className = "pop go";
  const mult = Math.round(ctx.mult * 10) / 10;
  d.innerHTML =
    '<span class="ht">' +
    (G.mode === "nolo" || G.sooli ? "Väistit · " : "") +
    ctx.type.n +
    (ctx.times > 1 ? " ×" + ctx.times : "") +
    "</span>" +
    '<span class="pill c">' +
    ctx.chips +
    '</span><span class="times">×</span>' +
    '<span class="pill m">' +
    mult +
    '</span><span class="times">=</span>' +
    '<span class="eq">' +
    ctx.total.toLocaleString("fi-FI") +
    "</span>";
  felt.appendChild(d);
  later(() => d.remove(), 1600);
}

/* ============================ overlayt ============================ */
