import { handPower } from "../ai.js";
import { ANTES, BLIND_MULT, BLIND_REWARD, TYPES } from "../constants.js";
import { descOf, fmt, nameOf, seatName, t, tList } from "../i18n.js";
import { ENH, VOUCHERS } from "../content.js";
import {
  beginPlay,
  beginSooliGive,
  bestAnte,
  nextBlind,
  runDeclarations,
  saveBest,
  showCardFor,
  sooliRisk,
  startBlind,
  startRun,
  startDeal,
  stepDeclare,
} from "../flow.js";
import { tuppiInfo } from "../scoring.js";
import { buy, rollShop } from "../shop.js";
import { G, later } from "../state.js";
import { closeDeclPanel, closeOverlay, declPanel, overlay, toast } from "./dom.js";
import { cardHTML, render } from "./render.js";

/* --- tuppipakka: vaihda kortteja käteen ennen näyttöä --- */
export function renderSwapPanel() {
  const picked = G.swapPick;
  const cards = G.sideDeck
    .map((c) => {
      const used = G.usedSide.indexOf(c.uid) >= 0;
      const cls = [
        "sidecard",
        picked && picked.uid === c.uid ? "picked" : "",
        used ? "used" : "",
      ].join(" ");
      return cardHTML(c, "mini " + cls).replace(
        "<div class=",
        '<div data-side="' + c.uid + '" class=',
      );
    })
    .join("");
  declPanel(
    "<h3>" +
      t("swap.title") +
      "</h3>" +
      '<div class="sidedeck">' +
      cards +
      "</div>" +
      '<div class="ln"><span>' +
      t(picked ? "swap.pickHand" : "swap.pickSide") +
      "</span><b>" +
      t("swap.count", { left: G.swapsLeft, total: G.swaps }) +
      "</b></div>" +
      '<p class="fine">' +
      t("swap.fine") +
      "</p>" +
      '<div class="row"><button class="btn" data-done>' +
      t("btn.toDeclaration") +
      "</button>" +
      (picked ? '<button class="btn ghost" data-cancel>' + t("btn.cancelPick") + "</button>" : "") +
      "</div>",
    (el) => {
      el.querySelectorAll("[data-side]").forEach(
        (b) =>
          (b.onclick = () => {
            const c = G.sideDeck.find((x) => x.uid === b.dataset.side);
            if (!c || G.usedSide.indexOf(c.uid) >= 0) return;
            if (G.swapsLeft <= 0) {
              toast(t("toast.noSwapsLeft"));
              return;
            }
            G.swapPick = c;
            renderSwapPanel();
          }),
      );
      el.querySelector("[data-done]").onclick = () => {
        G.swapPick = null;
        closeDeclPanel();
        runDeclarations();
      };
      const cx = el.querySelector("[data-cancel]");
      if (cx)
        cx.onclick = () => {
          G.swapPick = null;
          renderSwapPanel();
        };
    },
  );
}

export function askDeclaration() {
  const forced = G.boss && G.boss.id === "pakkorami";
  const prev = G.declSeq.slice(0, G.declIdx);
  const already = prev.some((p) => G.shows[p].decl === "rami");
  const power = handPower(G, 0);
  render();
  declPanel(
    "<h3>" +
      t("declare.title") +
      "</h3>" +
      '<div class="ln"><span>' +
      t("declare.power") +
      "</span><b>" +
      power +
      t(power >= 9 ? "declare.powerGood" : "declare.powerWeak") +
      "</b></div>" +
      (prev.length
        ? '<div class="ln"><span>' +
          t("declare.alreadyShown") +
          "</span><b>" +
          prev.map((x) => seatName(x) + " " + G.shows[x].decl).join(" · ") +
          "</b></div>"
        : "") +
      (already
        ? '<p class="warn" style="margin-top:8px">' + t("declare.ramiAlready") + "</p>"
        : "") +
      (forced ? '<p class="warn" style="margin-top:8px">' + t("declare.forced") + "</p>" : "") +
      '<p class="fine">' +
      t("declare.fine") +
      "</p>" +
      '<div class="row">' +
      '<button class="btn" data-d="rami">' +
      t("btn.showRami") +
      "</button>" +
      '<button class="btn blue" data-d="nolo"' +
      (forced ? " disabled" : "") +
      ">" +
      t("btn.showNolo") +
      "</button></div>",
    (el) =>
      el.querySelectorAll("[data-d]").forEach(
        (b) =>
          (b.onclick = () => {
            G.shows[0] = { decl: b.dataset.d, card: showCardFor(0, b.dataset.d) };
            G.declIdx++;
            closeDeclPanel();
            render();
            later(stepDeclare, 420);
          }),
      ),
  );
}

export function offerSooli() {
  const need = Math.ceil(G.target / 1);
  const risk = sooliRisk();
  declPanel(
    "<h3>" +
      t("sooli.title") +
      "</h3>" +
      "<p>" +
      t("sooli.body", { who: seatName(G.ramSeat) }) +
      "</p>" +
      '<div class="ln"><span>' +
      t("sooli.onSuccess") +
      "</span><b>" +
      t("sooli.onSuccessVal") +
      "</b></div>" +
      '<div class="ln"><span>' +
      t("sooli.onFail") +
      "</span><b>" +
      t("sooli.onFailVal") +
      "</b></div>" +
      '<div class="ln"><span>' +
      t("sooli.highCards") +
      "</span><b>" +
      risk.high +
      "</b></div>" +
      '<div class="ln"><span>' +
      t("sooli.lowGuards") +
      "</span><b>" +
      risk.lowGuards +
      "/4</b></div>" +
      '<div class="ln"><span>' +
      t("sooli.verdict") +
      "</span><b>" +
      risk.verdict +
      "</b></div>" +
      '<div class="ln"><span>' +
      t("sooli.target") +
      "</span><b>" +
      fmt(need) +
      "</b></div>" +
      '<div class="row"><button class="btn" data-y>' +
      t("btn.playSooli") +
      "</button>" +
      '<button class="btn ghost" data-n>' +
      t("btn.playNormally") +
      "</button></div>",
    (el) => {
      el.querySelector("[data-y]").onclick = () => {
        closeDeclPanel();
        beginSooliGive();
      };
      el.querySelector("[data-n]").onclick = () => {
        closeDeclPanel();
        beginPlay();
      };
    },
  );
}

/* Tuppi: soolaaja antaa parilleen yhden kortin ja saa yhden tilalle sokkona.
   Annettava kortti on soolaajan valinta, ei pelin. */

export function showDealEnd(sc) {
  const info = tuppiInfo(G);
  let why;
  if (G.sooliBust) why = t("why.sooliBust");
  else if (G.mode === "rami" && G.usTricks < 7) why = t("why.ramiShort", { won: G.usTricks });
  else if (G.mode === "nolo" && G.usTricks > 6) why = t("why.noloBust", { won: G.usTricks });
  else why = t("why.tricks", { us: G.usTricks, them: G.themTricks, mult: info.mult });
  const missing = G.target - G.blindScore;
  overlay(
    "<h2>" +
      t(sc > 0 ? "dealEnd.scored" : "dealEnd.wasted") +
      "</h2>" +
      '<p class="dek">' +
      why +
      "</p>" +
      '<div class="cashline"><span>' +
      t("dealEnd.thisDeal") +
      "</span><b>" +
      fmt(sc) +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("dealEnd.blindScore") +
      "</span><b>" +
      fmt(G.blindScore) +
      " / " +
      fmt(G.target) +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("dealEnd.dealsLeft") +
      "</span><b>" +
      G.dealsLeft +
      "</b></div>" +
      '<p class="dek" style="margin-top:14px">' +
      t("dealEnd.missing", { n: fmt(missing) }) +
      "</p>" +
      '<div class="row"><button class="btn" data-next>' +
      t("btn.nextDeal") +
      "</button></div>",
    (el) =>
      (el.querySelector("[data-next]").onclick = () => {
        G.dealer = (G.dealer + 1) % 4;
        startDeal();
      }),
  );
}

/* ============================ raha & kauppa ============================ */

export function showBlindSelect() {
  const rows = [0, 1, 2]
    .map((i) => {
      const req = Math.round(ANTES[G.ante - 1] * BLIND_MULT[i]);
      return (
        '<div class="bcard ' +
        (i === G.blindIdx ? "now" : G.beaten[i] ? "done" : "") +
        '">' +
        '<div class="blindmark bm-' +
        i +
        '">' +
        (i === 2 ? "☠" : i === 1 ? "◉" : "●") +
        "</div>" +
        "<h3>" +
        t("blind." + i) +
        "</h3>" +
        '<div class="req">' +
        fmt(req) +
        "</div>" +
        '<div class="rw">' +
        t("blindSelect.reward", { amount: "$" + BLIND_REWARD[i] }) +
        "</div></div>"
      );
    })
    .join("");

  overlay(
    "<h2>" +
      t("blindSelect.title", { ante: G.ante, name: t("blind." + G.blindIdx) }) +
      "</h2>" +
      '<p class="dek">' +
      t("blindSelect.intro") +
      "</p>" +
      '<div class="blinds">' +
      rows +
      "</div>" +
      '<div class="row"><button class="btn" data-play>' +
      t("btn.deal") +
      "</button>" +
      (G.blindIdx < 2 ? '<button class="btn ghost" data-skip>' + t("btn.skip") + "</button>" : "") +
      '<button class="btn ghost" data-rules>' +
      t("btn.rules") +
      "</button></div>",
    (el) => {
      el.querySelector("[data-play]").onclick = startBlind;
      const sk = el.querySelector("[data-skip]");
      if (sk)
        sk.onclick = () => {
          G.money += 2;
          G.beaten[G.blindIdx] = true;
          G.blindIdx++;
          G.dealer = (G.dealer + 1) % 4;
          showBlindSelect();
          render();
        };
      el.querySelector("[data-rules]").onclick = showRules;
    },
  );
}

export function showCashOut(sc) {
  const info = tuppiInfo(G);
  const over = G.sooli
    ? 0
    : G.mode === "rami"
      ? Math.max(0, G.usTricks - 6)
      : Math.max(0, 7 - G.usTricks);
  const interest = Math.min(5, Math.floor(G.money / 5));
  const base = BLIND_REWARD[G.blindIdx];
  const bonus = G.sooli ? 6 : over;
  const spare = Math.max(0, G.dealsLeft);
  G.money += base + bonus + interest + spare;
  const afterBoss = G.blindIdx === 2;
  overlay(
    "<h2>" +
      t(G.sooli ? "cash.sooli" : G.mode === "rami" ? "cash.rami" : "cash.nolo") +
      "</h2>" +
      '<p class="dek">' +
      t("cash.summary", {
        score: fmt(G.blindScore),
        target: fmt(G.target),
        last: fmt(sc),
        us: G.usTricks,
        them: G.themTricks,
        mult: info.mult,
      }) +
      "</p>" +
      '<div class="cashline"><span>' +
      t("cash.reward") +
      "</span><b>$" +
      base +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t(G.sooli ? "cash.sooliBonus" : G.mode === "rami" ? "cash.overTricks" : "cash.underTricks") +
      "</span><b>$" +
      bonus +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("cash.spareDeals") +
      "</span><b>$" +
      spare +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("cash.interest") +
      "</span><b>$" +
      interest +
      "</b></div>" +
      '<div class="cashtot"><span>' +
      t("cash.bank") +
      "</span><b>$" +
      G.money +
      "</b></div>" +
      '<div class="row" style="margin-top:18px"><button class="btn gold" data-shop>' +
      t("btn.toShop") +
      "</button></div>",
    (el) =>
      (el.querySelector("[data-shop]").onclick = () => {
        rollShop(afterBoss);
        showShop();
      }),
  );
}

export function showShop() {
  G.phase = "shop";
  const items = G.shop
    .map((it, i) => {
      const rar =
        it.kind === "joker"
          ? t("rarity." + it.data.r)
          : it.kind === "voucher"
            ? t("shop.voucher")
            : it.kind === "card"
              ? t("shop.card")
              : t("shop.trick");
      const afford = G.money >= it.price && !it.sold;
      return (
        '<div class="item kind-' +
        it.kind +
        (it.sold ? " sold" : "") +
        '">' +
        '<div class="top"><div class="glyph">' +
        it.data.g +
        "</div><div>" +
        "<h4>" +
        nameOf(it.data) +
        (it.data.cardLabel ? " " + it.data.cardLabel : "") +
        '</h4><div class="rar">' +
        rar +
        (it.data.mode ? " · " + t("shop.modeOnly", { mode: it.data.mode }) : "") +
        "</div></div></div>" +
        '<div class="tx">' +
        descOf(it.data) +
        "</div>" +
        '<button class="buy" data-buy="' +
        i +
        '"' +
        (afford ? "" : " disabled") +
        ">" +
        (it.sold ? t("shop.sold") : t("shop.buy", { price: it.price })) +
        "</button></div>"
      );
    })
    .join("");

  overlay(
    "<h2>" +
      t("shop.title") +
      "</h2>" +
      '<p class="dek">' +
      t("shop.status", {
        money: '<b style="color:var(--money);font-family:var(--font-m)">$' + G.money + "</b>",
        jokers: G.jokers.length + "/" + G.jokerSlots,
        tricks: G.consumables.length + "/" + G.consSlots,
      }) +
      " " +
      t("shop.orderNote") +
      (G.shopAfterBoss ? " " + t("shop.voucherNote") : "") +
      "</p>" +
      '<div class="shelf">' +
      items +
      "</div>" +
      (G.vouchers.length
        ? '<p class="dek">' +
          t("shop.permanent", {
            list: G.vouchers.map((v) => nameOf(VOUCHERS.find((x) => x.id === v))).join(", "),
          }) +
          "</p>"
        : "") +
      '<div class="row"><button class="btn" data-next>' +
      t("btn.nextBlind") +
      "</button>" +
      '<button class="btn ghost" data-rr' +
      (G.money < G.rerollCost ? " disabled" : "") +
      ">" +
      t("btn.reroll", { price: G.rerollCost }) +
      "</button></div>",
    (el) => {
      el.querySelectorAll("[data-buy]").forEach(
        (b) => (b.onclick = () => buy(parseInt(b.dataset.buy, 10))),
      );
      el.querySelector("[data-next]").onclick = nextBlind;
      el.querySelector("[data-rr]").onclick = () => {
        if (G.money < G.rerollCost) return;
        G.money -= G.rerollCost;
        const c = G.rerollCost;
        rollShop(G.shopAfterBoss);
        G.rerollCost = c + 2;
        showShop();
        render();
      };
    },
  );
  render();
}

export function showSeedDialog() {
  const cur = G.seed;
  overlay(
    "<h2>" +
      t("seed.title") +
      "</h2>" +
      '<p class="dek">' +
      t("seed.intro") +
      "</p>" +
      '<div class="ln" style="border:0;padding:0"><span class="lbl">' +
      t("seed.current") +
      "</span></div>" +
      '<input class="seedfield" id="seedcur" value="' +
      cur +
      '" readonly>' +
      '<p class="dek" style="margin:12px 0 2px">' +
      t("seed.newPrompt") +
      "</p>" +
      '<input class="seedfield" id="seednew" placeholder="' +
      cur +
      '" maxlength="32" ' +
      'autocomplete="off" spellcheck="false">' +
      '<div class="row" style="margin-top:14px">' +
      '<button class="btn" data-start>' +
      t("btn.startRun") +
      "</button>" +
      '<button class="btn ghost" data-same>' +
      t("btn.replaySeed") +
      "</button>" +
      '<button class="btn ghost" data-x>' +
      t("btn.cancel") +
      "</button></div>",
    (el) => {
      const curEl = el.querySelector("#seedcur");
      if (curEl) curEl.onclick = () => curEl.select();
      const newEl = el.querySelector("#seednew");
      if (newEl) later(() => newEl.focus(), 0);
      el.querySelector("[data-start]").onclick = () => startRun(newEl ? newEl.value : "");
      el.querySelector("[data-same]").onclick = () => startRun(cur);
      el.querySelector("[data-x]").onclick = () => {
        closeOverlay();
        if (G.phase === "blindselect") showBlindSelect();
        else if (G.phase === "shop") showShop();
        else render();
      };
    },
  );
}

export function showGameOver() {
  saveBest(G.ante);
  const info = tuppiInfo(G);
  let why;
  if (G.sooliBust) why = t("over.sooliBust");
  else if (G.mode === "rami" && G.usTricks < 7) why = t("over.ramiShort", { won: G.usTricks });
  else if (G.mode === "nolo" && G.usTricks > 6) why = t("over.noloBust", { won: G.usTricks });
  else why = t("over.thin", { mult: info.mult });
  why += " " + t("over.allDealsPlayed", { deals: G.deals });

  overlay(
    "<h2>" +
      t("over.title") +
      "</h2>" +
      '<p class="dek">' +
      t("over.summary", { score: fmt(G.blindScore), target: fmt(G.target) }) +
      " " +
      why +
      "</p>" +
      '<div class="cashline"><span>' +
      t("over.ante") +
      "</span><b>" +
      G.ante +
      "/8</b></div>" +
      '<div class="cashline"><span>' +
      t("over.tricks") +
      "</span><b>" +
      G.usTricks +
      "–" +
      G.themTricks +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("over.best") +
      "</span><b>" +
      Math.max(bestAnte(), G.ante) +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("seed.label") +
      "</span><b>" +
      G.seed +
      "</b></div>" +
      '<div class="row" style="margin-top:18px"><button class="btn" data-new>' +
      t("btn.newGame") +
      "</button>" +
      '<button class="btn ghost" data-retry>' +
      t("btn.replaySeed") +
      "</button>" +
      '<button class="btn ghost" data-rules>' +
      t("btn.rules") +
      "</button></div>",
    (el) => {
      const seed = G.seed;
      el.querySelector("[data-new]").onclick = () => startRun();
      el.querySelector("[data-retry]").onclick = () => startRun(seed);
      el.querySelector("[data-rules]").onclick = showRules;
    },
  );
}

export function showVictory() {
  saveBest(9);
  overlay(
    "<h2>" +
      t("win.title") +
      "</h2>" +
      '<p class="dek">' +
      t("win.body") +
      "</p>" +
      '<div class="cashline"><span>' +
      t("cash.bank") +
      "</span><b>$" +
      G.money +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("win.jokers") +
      "</span><b>" +
      (G.jokers.map((j) => nameOf(j)).join(", ") || "–") +
      "</b></div>" +
      '<div class="cashline"><span>' +
      t("seed.label") +
      "</span><b>" +
      G.seed +
      "</b></div>" +
      '<div class="row" style="margin-top:18px"><button class="btn gold" data-new>Uusi peli</button></div>',
    (el) => (el.querySelector("[data-new]").onclick = () => startRun()),
  );
}

export function showRules() {
  const rows = Object.values(TYPES)
    .map(
      (ty) =>
        "<tr><td>" +
        t("type." + ty.id) +
        '</td><td class="n">' +
        ty.chips +
        '</td><td class="n">×' +
        ty.mult +
        "</td></tr>",
    )
    .join("");
  const li = (key) =>
    tList(key)
      .map((x) => "<li>" + x + "</li>")
      .join("");
  const enhRows = Object.keys(ENH)
    .map(
      (k) =>
        "<tr><td>" + ENH[k].g + " " + nameOf(ENH[k]) + "</td><td>" + descOf(ENH[k]) + "</td></tr>",
    )
    .join("");
  overlay(
    "<h2>" +
      t("rules.title") +
      "</h2>" +
      '<p class="dek">' +
      t("rules.intro") +
      "</p>" +
      '<div class="rules"><div class="cols"><div>' +
      "<h3>" +
      t("rules.tuppiTitle") +
      "</h3><ul>" +
      li("rules.tuppi") +
      "</ul></div><div>" +
      "<h3>" +
      t("rules.balatroTitle") +
      "</h3><ul>" +
      li("rules.balatro") +
      "</ul></div></div>" +
      "<h3>" +
      t("rules.enhTitle") +
      "</h3>" +
      "<p>" +
      t("rules.enhIntro") +
      "</p>" +
      '<table class="tbl"><thead><tr><th>' +
      t("rules.enhCol") +
      "</th><th>" +
      t("rules.effectCol") +
      "</th></tr></thead><tbody>" +
      enhRows +
      "</tbody></table>" +
      "<h3>" +
      t("rules.typesTitle") +
      "</h3>" +
      "<p>" +
      t("rules.typesIntro") +
      "</p>" +
      '<table class="tbl"><thead><tr><th>' +
      t("rules.trickCol") +
      '</th><th class="n">Chips</th><th class="n">Mult</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      '<p style="margin-top:10px">' +
      t("rules.chipNote") +
      "</p>" +
      '<p style="margin-top:10px;font-size:12.5px;color:#8FA89A">' +
      t("rules.source") +
      "</p>" +
      '</div><div class="row" style="margin-top:18px"><button class="btn" data-x>' +
      t("btn.back") +
      "</button></div>",
    (el) =>
      (el.querySelector("[data-x]").onclick = () => {
        closeOverlay();
        if (G.phase === "blindselect") showBlindSelect();
        else if (G.phase === "shop") showShop();
        else render();
      }),
  );
}
