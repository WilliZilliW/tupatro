import { handPower } from "../ai.js";
import { ANTES, BLIND_MULT, BLIND_NAME, BLIND_REWARD, SEATS, TYPES } from "../constants.js";
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
    "<h3>Tuppipakka</h3>" +
      '<div class="sidedeck">' +
      cards +
      "</div>" +
      '<div class="ln"><span>' +
      (picked ? "Valitse kortti <b>kädestäsi</b>" : "Valitse kortti tuppipakasta") +
      "</span><b>" +
      G.swapsLeft +
      "/" +
      G.swaps +
      " vaihtoa</b></div>" +
      '<p class="fine">Vaihdot tehdään ennen näyttöä, joten ne vaikuttavat myös siihen ramaatko vai et. ' +
      "Vaihdettu kortti poistuu tästä jaosta; tuppipakka säilyy jaosta toiseen.</p>" +
      '<div class="row"><button class="btn" data-done>Näyttöön</button>' +
      (picked ? '<button class="btn ghost" data-cancel>Peruuta valinta</button>' : "") +
      "</div>",
    (el) => {
      el.querySelectorAll("[data-side]").forEach(
        (b) =>
          (b.onclick = () => {
            const c = G.sideDeck.find((x) => x.uid === b.dataset.side);
            if (!c || G.usedSide.indexOf(c.uid) >= 0) return;
            if (G.swapsLeft <= 0) {
              toast("Vaihdot käytetty.");
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
    "<h3>Näytä korttisi</h3>" +
      '<div class="ln"><span>Käden voima</span><b>' +
      power +
      (power >= 9 ? " — rami kannattaa" : " — heikko rami") +
      "</b></div>" +
      (prev.length
        ? '<div class="ln"><span>Jo näyttäneet</span><b>' +
          prev.map((x) => SEATS[x].name + " " + G.shows[x].decl).join(" · ") +
          "</b></div>"
        : "") +
      (already
        ? '<p class="warn" style="margin-top:8px">Rami on jo näytetty — jaosta tulee rami joka tapauksessa.</p>'
        : "") +
      (forced
        ? '<p class="warn" style="margin-top:8px">Pomo pakottaa sinut näyttämään ramia.</p>'
        : "") +
      '<p class="fine">Punainen = <b>rami</b>, kerää 7 tikkiä 13:sta. Musta = <b>nolo</b>, väistä tikit. ' +
      "Rami voittaa, jos yksikin näyttää sitä. Voima: ässä 3, kuningas 2, rouva 1, lyhyt maa 1.</p>" +
      '<div class="row">' +
      '<button class="btn" data-d="rami">Punainen — RAMI</button>' +
      '<button class="btn blue" data-d="nolo"' +
      (forced ? " disabled" : "") +
      ">Musta — NOLO</button></div>",
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
    "<h3>Sooli?</h3>" +
      "<p>" +
      SEATS[G.ramSeat].name +
      " näytti ramia. Puolustavan parin toinen pelaaja saa halutessaan " +
      "pelata <b>yksin</b> ramaajia vastaan. Veikko jättää korttinsa pöytään etkä saa viedä ainuttakaan tikkiä. " +
      "Vaihdat Veikon kanssa yhden kortin sokkona (annat korkeimpasi), ässä on soolissa <b>pienin</b> kortti ja sinä pelaat aina viimeisenä. " +
      "Sooli kannattaa vain poikkeuksellisen matalalla kädellä — ramaajat ajavat matalia kortteja pakottaakseen sinut tikille. Katso kätesi alta.</p>" +
      '<div class="ln"><span>Onnistuu (0 tikkiä)</span><b>×6, kaikki 13 tikkiä</b></div>' +
      '<div class="ln"><span>Epäonnistuu (1 tikki riittää)</span><b>jako menetetty</b></div>' +
      '<div class="ln"><span>Korkeita kortteja (10–K)</span><b>' +
      risk.high +
      "</b></div>" +
      '<div class="ln"><span>Matala vahti maassa (A tai 2–3)</span><b>' +
      risk.lowGuards +
      "/4</b></div>" +
      '<div class="ln"><span>Käden sooliarvio</span><b>' +
      risk.verdict +
      "</b></div>" +
      '<div class="ln"><span>Panoksen tavoite</span><b>' +
      need.toLocaleString("fi-FI") +
      "</b></div>" +
      '<div class="row"><button class="btn" data-y>Soolaan</button>' +
      '<button class="btn ghost" data-n>Pelataan normaalisti</button></div>',
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
  if (G.sooliBust) why = "Sooli kaatui — yksikin tikki riitti kaatamaan sen.";
  else if (G.mode === "rami" && G.usTricks < 7)
    why =
      "Rami jäi vajaaksi (" +
      G.usTricks +
      "/7). Tupissa se on ryöstö: jako ei tuota teille mitään.";
  else if (G.mode === "nolo" && G.usTricks > 6)
    why = "Nolo kaatui: veitte " + G.usTricks + " tikkiä eli enemmän kuin vastustajat.";
  else why = "Tikit " + G.usTricks + "–" + G.themTricks + ", tuppi-kerroin ×" + info.mult + ".";
  const puuttuu = G.target - G.blindScore;
  overlay(
    "<h2>" +
      (sc > 0 ? "Jako pisteisiin" : "Jako meni hukkaan") +
      "</h2>" +
      '<p class="dek">' +
      why +
      "</p>" +
      '<div class="cashline"><span>Tämä jako</span><b>' +
      sc.toLocaleString("fi-FI") +
      "</b></div>" +
      '<div class="cashline"><span>Panoksen pisteet</span><b>' +
      G.blindScore.toLocaleString("fi-FI") +
      " / " +
      G.target.toLocaleString("fi-FI") +
      "</b></div>" +
      '<div class="cashline"><span>Jakoja jäljellä</span><b>' +
      G.dealsLeft +
      "</b></div>" +
      '<p class="dek" style="margin-top:14px">Tavoitteeseen puuttuu <b>' +
      puuttuu.toLocaleString("fi-FI") +
      "</b>. Kortit sekoitetaan ja jaetaan uudelleen.</p>" +
      '<div class="row"><button class="btn" data-next>Seuraava jako</button></div>',
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
        BLIND_NAME[i] +
        "</h3>" +
        '<div class="req">' +
        req.toLocaleString("fi-FI") +
        "</div>" +
        '<div class="rw">palkkio $' +
        BLIND_REWARD[i] +
        "</div></div>"
      );
    })
    .join("");

  overlay(
    "<h2>Panos " +
      G.ante +
      " – " +
      BLIND_NAME[G.blindIdx] +
      "</h2>" +
      '<p class="dek">Neljä tuppijakoa, kussakin kolmetoista tikkiä. Joka jaon alussa näyttökierros: rami vai nolo. ' +
      "Pisteet kertyvät jaosta toiseen — tavoite pitää saada täyteen ennen kuin jaot loppuvat. " +
      "Käyttämättä jäänyt jako maksaa $1.</p>" +
      '<div class="blinds">' +
      rows +
      "</div>" +
      '<div class="row"><button class="btn" data-play>Jaa kortit</button>' +
      (G.blindIdx < 2 ? '<button class="btn ghost" data-skip>Ohita (+$2)</button>' : "") +
      '<button class="btn ghost" data-rules>Ohjeet</button></div>',
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
      (G.sooli ? "Sooli meni läpi" : G.mode === "rami" ? "Rami kotiin" : "Nolo hoidettu") +
      "</h2>" +
      '<p class="dek">Panos ' +
      G.blindScore.toLocaleString("fi-FI") +
      " / " +
      G.target.toLocaleString("fi-FI") +
      ", viimeinen jako " +
      sc.toLocaleString("fi-FI") +
      ". Tikit " +
      G.usTricks +
      "–" +
      G.themTricks +
      ", tuppi-kerroin ×" +
      info.mult +
      ".</p>" +
      '<div class="cashline"><span>Panoksen palkkio</span><b>$' +
      base +
      "</b></div>" +
      '<div class="cashline"><span>' +
      (G.sooli ? "Sooli" : G.mode === "rami" ? "Tikit yli kuuden" : "Tikit alle seitsemän") +
      "</span><b>$" +
      bonus +
      "</b></div>" +
      '<div class="cashline"><span>Käyttämättä jääneet jaot</span><b>$' +
      spare +
      "</b></div>" +
      '<div class="cashline"><span>Korko (1 per $5)</span><b>$' +
      interest +
      "</b></div>" +
      '<div class="cashtot"><span>Kassa</span><b>$' +
      G.money +
      "</b></div>" +
      '<div class="row" style="margin-top:18px"><button class="btn gold" data-shop>Kauppaan</button></div>',
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
          ? it.data.r
          : it.kind === "voucher"
            ? "kuponki"
            : it.kind === "card"
              ? "kortti tuppipakkaan"
              : "temppu";
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
        it.data.n +
        '</h4><div class="rar">' +
        rar +
        (it.data.mode ? " · vain " + it.data.mode : "") +
        "</div></div></div>" +
        '<div class="tx">' +
        it.data.t +
        "</div>" +
        '<button class="buy" data-buy="' +
        i +
        '"' +
        (afford ? "" : " disabled") +
        ">" +
        (it.sold ? "Ostettu" : "Osta $" + it.price) +
        "</button></div>"
      );
    })
    .join("");

  overlay(
    "<h2>Kauppa</h2>" +
      '<p class="dek">Kassa <b style="color:var(--money);font-family:var(--font-m)">$' +
      G.money +
      "</b> · " +
      "jokeripaikat " +
      G.jokers.length +
      "/" +
      G.jokerSlots +
      " · temput " +
      G.consumables.length +
      "/" +
      G.consSlots +
      ". " +
      "Jokerit vaikuttavat siinä järjestyksessä kuin ne on ostettu: ensin kaikki lisäykset, sitten kertoimet. " +
      "Myydä voi vasemman reunan listasta." +
      (G.shopAfterBoss ? " Pomon jälkeen hyllyllä voi olla pysyviä kuponkeja." : "") +
      "</p>" +
      '<div class="shelf">' +
      items +
      "</div>" +
      (G.vouchers.length
        ? '<p class="dek">Pysyvät: ' +
          G.vouchers.map((v) => VOUCHERS.find((x) => x.id === v).n).join(", ") +
          "</p>"
        : "") +
      '<div class="row"><button class="btn" data-next>Seuraava panos</button>' +
      '<button class="btn ghost" data-rr' +
      (G.money < G.rerollCost ? " disabled" : "") +
      ">Uudet tavarat $" +
      G.rerollCost +
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
    "<h2>Siemen</h2>" +
      '<p class="dek">Sama siemen ja samat päätökset tuottavat saman ajon: samat jaot, ' +
      "samat pomot ja sama kaupan valikoima. Talleta siemen jos haluat pelata ajon uudelleen " +
      "tai näyttää sen jollekin toiselle.</p>" +
      '<div class="ln" style="border:0;padding:0"><span class="lbl">Nykyinen ajo</span></div>' +
      '<input class="seedfield" id="seedcur" value="' +
      cur +
      '" readonly>' +
      '<p class="dek" style="margin:12px 0 2px">Aloita uusi ajo siemenellä (tyhjä = satunnainen):</p>' +
      '<input class="seedfield" id="seednew" placeholder="' +
      cur +
      '" maxlength="32" ' +
      'autocomplete="off" spellcheck="false">' +
      '<div class="row" style="margin-top:14px">' +
      '<button class="btn" data-start>Aloita uusi ajo</button>' +
      '<button class="btn ghost" data-same>Toista tämä siemen</button>' +
      '<button class="btn ghost" data-x>Peruuta</button></div>',
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
  if (G.sooliBust) why = "Sooli kaatui heti ensimmäiseen tikkiin — ramaajat korjasivat potin.";
  else if (G.mode === "rami" && G.usTricks < 7)
    why =
      "Rami jäi vajaaksi (" +
      G.usTricks +
      "/7). Tupissa se tarkoittaa ryöstöä: vastapuoli laskee pisteet kaksinkertaisina.";
  else if (G.mode === "nolo" && G.usTricks > 6)
    why = "Nolo kaatui: veitte " + G.usTricks + " tikkiä, eli enemmän kuin vastustajat.";
  else why = "Kerroin ×" + info.mult + " ei riittänyt — pohja jäi liian ohueksi.";
  why += " Panoksen kaikki " + G.deals + " jakoa on pelattu.";

  overlay(
    "<h2>Jouduitte tuppeen</h2>" +
      '<p class="dek">Panoksen pisteet ' +
      G.blindScore.toLocaleString("fi-FI") +
      ", tavoite oli " +
      G.target.toLocaleString("fi-FI") +
      ". " +
      why +
      "</p>" +
      '<div class="cashline"><span>Panos</span><b>' +
      G.ante +
      "/8</b></div>" +
      '<div class="cashline"><span>Tikit</span><b>' +
      G.usTricks +
      "–" +
      G.themTricks +
      "</b></div>" +
      '<div class="cashline"><span>Paras panos</span><b>' +
      Math.max(bestAnte(), G.ante) +
      "</b></div>" +
      '<div class="cashline"><span>Siemen</span><b>' +
      G.seed +
      "</b></div>" +
      '<div class="row" style="margin-top:18px"><button class="btn" data-new>Uusi peli</button>' +
      '<button class="btn ghost" data-retry>Toista tämä siemen</button>' +
      '<button class="btn ghost" data-rules>Ohjeet</button></div>',
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
    "<h2>Vastapuoli tuppeen</h2>" +
      '<p class="dek">Kahdeksan panosta kaadettu. Oikeassa tupissa peli päättyy, kun toinen pari kerää 52 pistettä — ' +
      "nyt se on tehty kahdeksassa jaossa ja jokeripinolla, jota Oulunsalon tuppikerhossa ei ihan hyväksyttäisi.</p>" +
      '<div class="cashline"><span>Kassa</span><b>$' +
      G.money +
      "</b></div>" +
      '<div class="cashline"><span>Jokerit</span><b>' +
      (G.jokers.map((j) => j.n).join(", ") || "–") +
      "</b></div>" +
      '<div class="cashline"><span>Siemen</span><b>' +
      G.seed +
      "</b></div>" +
      '<div class="row" style="margin-top:18px"><button class="btn gold" data-new>Uusi peli</button></div>',
    (el) => (el.querySelector("[data-new]").onclick = () => startRun()),
  );
}

export function showRules() {
  const rows = Object.values(TYPES)
    .map(
      (t) =>
        "<tr><td>" +
        t.n +
        '</td><td class="n">' +
        t.chips +
        '</td><td class="n">×' +
        t.mult +
        "</td></tr>",
    )
    .join("");
  overlay(
    "<h2>Ohjeet</h2>" +
      '<p class="dek">Tupin säännöt, Balatron rakenne. Istut etelässä, Veikko on parisi pohjoisessa, ' +
      "Raimo ja Sirpa vastustavat.</p>" +
      '<div class="rules"><div class="cols"><div>' +
      "<h3>Tuppi — oikeat säännöt</h3><ul>" +
      "<li>Neljä pelaajaa, kaksi paria vastakkain, koko pakka, 13 korttia kullekin.</li>" +
      "<li><b>Valttia ei ole.</b> Maantuntopakko: ajettua maata on tunnustettava, muuten saa pelata mitä vain.</li>" +
      "<li>Tikin voittaa suurin ajetun maan kortti. Ässä on korkein.</li>" +
      "<li><b>Näyttö:</b> etukäsi (jakajan vasen) näyttää ensin, sitten myötäpäivään. Punainen kortti = rami, musta = nolo. Kuvakorttia tai ässää ei saa näyttää. Ramia pelataan, jos yksikin näyttää sitä.</li>" +
      "<li><b>Rami:</b> tavoite 7 tikkiä = 4 pistettä, ja joka lisätikki 4 lisää.</li>" +
      "<li><b>Nolo:</b> vähemmän tikkejä vienyt pari voittaa. 6 tikkiä = 4 pistettä, joka tikki vähemmän 4 lisää.</li>" +
      "<li><b>Ryöstö:</b> jos ramannut pari jää alle seitsemän, vastapuoli laskee pisteensä kaksinkertaisina.</li>" +
      "<li><b>Sooli:</b> puolustava pelaaja voi pelata yksin. Yksi kortti vaihdetaan parin kanssa, ässä on pienin ja soolaaja pelaa viimeisenä. Tikitön sooli = 24 pistettä, yksikin tikki = 24 ramaajille.</li>" +
      "<li>Peli päättyy 52 pisteeseen: hävinnyt pari on saatu <i>tuppeen</i>.</li>" +
      "</ul></div><div>" +
      "<h3>Mitä Balatro tuo</h3><ul>" +
      "<li>Kahdeksan panosta, kussakin pieni, iso ja pomo. Pomon tavoite on kaksinkertainen ja sillä on sääntömuutos.</li>" +
      "<li>Yksi panos = neljä tuppijakoa, joiden pisteet lasketaan yhteen (kuten Balatron neljä kättä). Jokainen pisteyttävä tikki lasketaan pokerikätenä: <b>Chips × Mult</b>.</li>" +
      "<li>Ramissa pisteytät <b>viemäsi</b> tikit, nolossa ja soolissa <b>väistämäsi</b>.</li>" +
      "<li>Tupin pistelasku on suoraan tuppi-kerroin: rami 7 tikkiä = ×1, 9 tikkiä = ×3; nolo 6 tikkiä = ×1, 3 tikkiä = ×4; ryöstö kaksinkertaistaa; sooli ×6.</li>" +
      "<li>Vajaa rami tai kaatunut nolo = kerroin 0: jako menee hukkaan, aivan kuten tupissa. Jakoja on neljä, joten yksi moka ei vielä kaada panosta.</li>" +
      "<li>Panoksen jälkeen kauppa: jokereita, jalostettuja kortteja, temppuja ja pomon jälkeen pysyviä kuponkeja.</li>" +
      "<li><b>Tuppipakka:</b> kaupasta ostetut kortit säilyvät ajon loppuun. Joka jaon alussa saat vaihtaa niistä " +
      "<b>2 korttia</b> käteesi — ennen näyttöä, joten vaihto vaikuttaa myös siihen ramaatko. Vaihdettu kortti poistuu siitä jaosta.</li>" +
      "<li>Laskujärjestys: korttien lisäykset, jokerien lisäykset, korttien kertoimet, jokerien kertoimet.</li>" +
      "</ul></div></div>" +
      "<h3>Korttijalosteet</h3>" +
      "<p>Kaksi parasta jalostetta eivät lisää numeroita vaan taivuttavat tupin sääntöjä.</p>" +
      '<table class="tbl"><thead><tr><th>Jaloste</th><th>Vaikutus</th></tr></thead><tbody>' +
      Object.keys(ENH)
        .map((k) => "<tr><td>" + ENH[k].g + " " + ENH[k].n + "</td><td>" + ENH[k].t + "</td></tr>")
        .join("") +
      "</tbody></table>" +
      "<h3>Tikkityypit</h3>" +
      "<p>Tikissä on neljä korttia (soolissa kolme). Koska maata on tunnustettava, <b>väri</b> on tavallisin tikki.</p>" +
      '<table class="tbl"><thead><tr><th>Tikki</th><th class="n">Chips</th><th class="n">Mult</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      '<p style="margin-top:10px">Korttien omat chipsit lasketaan päälle: 2–10 arvonsa verran, kuvat 10, ässä 11.</p>' +
      '<p style="margin-top:10px;font-size:12.5px;color:#8FA89A">Tupin säännöt tarkistettu Oulun Seniorien tuppikerhon sääntöpaperista (Antti Auer, 9.9.2022) ja korttipeliopas.fi:stä.</p>' +
      '</div><div class="row" style="margin-top:18px"><button class="btn" data-x>Takaisin</button></div>',
    (el) =>
      (el.querySelector("[data-x]").onclick = () => {
        closeOverlay();
        if (G.phase === "blindselect") showBlindSelect();
        else if (G.phase === "shop") showShop();
        else render();
      }),
  );
}
