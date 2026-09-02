/*
 * Tupatro rule tests. Run: node test.js
 *
 * The game is a single HTML file, because a published Artifact cannot load
 * external scripts. So these tests do not import a module: they extract the
 * <script> block from the file and run it against a light DOM stub. The source
 * stays a single source of truth with no build step, while the pure rule
 * functions stay testable in milliseconds without a browser.
 */
"use strict";
const fs = require("fs");
const path = require("path");

/* ---------------- DOM stub ---------------- */
function makeEl(id) {
  const el = {
    id: id || "",
    _html: "",
    textContent: "",
    className: "",
    dataset: {},
    style: {},
    children: [],
    scrollWidth: 0, clientWidth: 0, scrollHeight: 0, clientHeight: 0,
    classList: { add() {}, remove() {}, contains() { return false; } },
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    removeChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    focus() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; },
    click() {}
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = String(v); }
  });
  return el;
}
const els = new Map();
const document = {
  getElementById(id) {
    if (!els.has(id)) els.set(id, makeEl(id));
    return els.get(id);
  },
  createElement() { return makeEl(); },
  querySelector() { return makeEl(); },
  querySelectorAll() { return []; },
  body: makeEl("body"),
  documentElement: makeEl("html")
};
const localStorage = {
  _d: {},
  getItem(k) { return k in this._d ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); }
};
/* Timers never fire: the tests call the rule functions directly. */
const setTimeoutStub = () => 0;
const clearTimeoutStub = () => {};
const windowStub = { setTimeout: setTimeoutStub, clearTimeout: clearTimeoutStub, matchMedia: () => ({ matches: false }) };

/* ---------------- load the game ---------------- */
const file = path.join(__dirname, "tupatro.html");
const html = fs.readFileSync(file, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("tupatro.html: no <script> block found"); process.exit(1); }

const EXPORTS = [
  "G", "mkCard", "rv", "chipValue", "cardName", "applySort", "deal",
  "leadSuit", "legalCards", "currentWinner", "matchesSuit", "isStone", "isWild",
  "evalTrick", "scoreTrick", "tuppiInfo", "tuppiMult", "finalScore", "scoresForUs",
  "handPower", "sooliRisk", "makeDeck", "shuffle", "trickSize", "nextSeat",
  "rnd", "setSeed", "makeSeed", "seedHash", "newGame", "rollShop", "SEED_ALPHABET",
  "TYPES", "ENH", "JOKERS", "CONSUMABLES", "VOUCHERS", "BOSSES", "ANTES", "SUITS", "SM"
];
/* G is a closure `let`, so it is exposed through a getter. */
const tail = "\nreturn {" + EXPORTS.map(n => (n === "G" ? "get G(){return G}" : n)).join(",") + "};";

let api;
try {
  api = new Function("document", "window", "localStorage", "setTimeout", "clearTimeout", m[1] + tail)(
    document, windowStub, localStorage, setTimeoutStub, clearTimeoutStub);
} catch (e) {
  console.error("Loading the game failed:", e.message);
  process.exit(1);
}

/* ---------------- test harness ---------------- */
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++; fails.push(name + (extra ? "  → " + extra : ""));
}
function eq(name, got, want) {
  ok(name, got === want, "got " + JSON.stringify(got) + ", expected " + JSON.stringify(want));
}
function near(name, got, want) {
  ok(name, Math.abs(got - want) < 1e-6, "got " + got + ", expected " + want);
}
function group(n) { console.log("\n" + n); }

const {
  mkCard, rv, chipValue, leadSuit, legalCards, currentWinner, matchesSuit,
  isStone, isWild, evalTrick, scoreTrick, tuppiInfo, TYPES, ENH, JOKERS, ANTES, SUITS
} = api;
const G = () => api.G;
const C = (s, r, e) => mkCard(s, r, e);

/* Reset the deal state before each assertion. */
function reset(over) {
  const g = G();
  Object.assign(g, {
    sooli: false, sooliBust: false, boss: null, chipBonus: 0, tuppiBonus: 0,
    mode: "rami", ramTeam: 0, usTricks: 0, themTricks: 0, scored: 0,
    jokers: [], sideDeck: [], trick: [], hands: [[], [], [], []], money: 0,
    sortMode: "suit", customOrder: false, dealer: 3, usedSide: [], swapsLeft: 0
  }, over || {});
}

/* ---------------- 1. follow-suit obligation ---------------- */
group("Follow-suit obligation");
reset();
G().trick = [{ p: 1, card: C("H", 13) }];
G().hands[0] = [C("H", 5), C("C", 9), C("S", 3)];
eq("must follow the led suit when holding it", legalCards(0).length, 1);
eq("  and it is the right card", legalCards(0)[0].id, "H5");
G().hands[0] = [C("C", 9), C("S", 3)];
eq("void in the suit: anything is legal", legalCards(0).length, 2);
G().trick = [];
eq("the leader may play anything", legalCards(0).length, 2);

/* ---------------- 2. trick winner, no trump ---------------- */
group("Trick winner (no trump)");
reset();
G().trick = [{ p: 0, card: C("H", 9) }, { p: 1, card: C("H", 13) }, { p: 2, card: C("S", 14) }, { p: 3, card: C("H", 4) }];
eq("highest card of the led suit wins", currentWinner().p, 1);
ok("another suit loses even as an ace", currentWinner().card.id !== "S14");
reset();
const dupA = C("S", 14), dupB = C("S", 14);
ok("duplicates get distinct uids", dupA.uid !== dupB.uid && dupA.id === dupB.id);
G().trick = [{ p: 1, card: dupA }, { p: 2, card: dupB }];
eq("a tie goes to the card played earlier", currentWinner().p, 1);

/* ---------------- 3. stone card ---------------- */
group("Stone card (no suit, no rank)");
reset();
G().trick = [{ p: 1, card: C("H", 13) }];
G().hands[0] = [C("H", 5), C("S", 2, "stone"), C("C", 9)];
let L = legalCards(0);
ok("stone is legal even when the suit could be followed", L.some(isStone));
ok("  but another wrong suit is not", !L.some(c => c.id === "C9"));
eq("  legal cards in total", L.length, 2);
reset();
/* The stone card's printed suit and rank are deliberately the ace of hearts: read
   as an ordinary card it would win the trick. The rule is that it cannot. */
G().trick = [{ p: 1, card: C("H", 3) }, { p: 2, card: C("H", 14, "stone") }, { p: 3, card: C("H", 2) }];
eq("stone does not win even with the highest printed rank", currentWinner().p, 1);
reset();
G().trick = [{ p: 1, card: C("H", 14, "stone") }, { p: 2, card: C("H", 3) }];
eq("stone does not win even as the sole high card", currentWinner().p, 2);
reset();
G().trick = [{ p: 0, card: C("S", 2, "stone") }, { p: 1, card: C("D", 4) }, { p: 2, card: C("D", 9) }];
eq("stone does not set the led suit", leadSuit(), "D");
eq("  the suit comes from the next card", currentWinner().p, 2);
reset();
eq("stone is worth 50 chips", chipValue(C("S", 2, "stone")), 50);
eq("stone is excluded from the trick type",
  evalTrick([C("H", 5), C("H", 9), C("H", 2), C("S", 2, "stone")]).id, "flush");

/* ---------------- 4. wild card ---------------- */
group("Wild card");
reset();
G().trick = [{ p: 1, card: C("H", 13) }];
G().hands[0] = [C("C", 9, "wild"), C("D", 4)];
eq("wild satisfies the follow-suit obligation", legalCards(0).length, 1);
ok("  and it is the wild card", isWild(legalCards(0)[0]));
reset();
G().trick = [{ p: 1, card: C("H", 13) }, { p: 2, card: C("C", 14, "wild") }];
eq("wild can win the trick", currentWinner().p, 2);
eq("wild completes a flush",
  evalTrick([C("H", 5), C("H", 9), C("H", 2), C("C", 7, "wild")]).id, "flush");
ok("wild is not stone", matchesSuit(C("C", 7, "wild"), "H") && !matchesSuit(C("S", 2, "stone"), "H"));

/* ---------------- 5. trick types ---------------- */
group("Trick types");
reset();
const ty = cs => evalTrick(cs).id;
eq("flush", ty([C("H", 2), C("H", 7), C("H", 9), C("H", 13)]), "flush");
eq("mixed trick", ty([C("H", 2), C("S", 7), C("D", 9), C("C", 12)]), "high");
eq("pair", ty([C("H", 7), C("S", 7), C("D", 9), C("C", 12)]), "pair");
eq("two pair", ty([C("H", 7), C("S", 7), C("D", 9), C("C", 9)]), "twopair");
eq("three of a kind", ty([C("H", 7), C("S", 7), C("D", 7), C("C", 12)]), "trips");
eq("four of a kind", ty([C("H", 7), C("S", 7), C("D", 7), C("C", 7)]), "quad");
eq("straight", ty([C("H", 5), C("S", 6), C("D", 7), C("C", 8)]), "straight");
eq("straight flush", ty([C("H", 5), C("H", 6), C("H", 7), C("H", 8)]), "sf");
eq("three-card trick (sooli)", ty([C("H", 5), C("H", 6), C("H", 7)]), "sf");

/* ---------------- 6. tuppi multiplier = tuppi's own scoring ---------------- */
group("Tuppi multiplier");
/* In tuppi: rami 7 tricks = 4 points and each further trick +4 -> multiplier is
   tricks-6. Nolo: 6 tricks = 4 points, each trick fewer +4 -> multiplier is
   7-tricks. Ryosto doubles it. Sooli 24 points = 6 x 4. */
function mult(over) { reset(over); return tuppiInfo().mult; }
eq("rami 6 tricks = short, scores nothing", mult({ mode: "rami", ramTeam: 0, usTricks: 6 }), 0);
eq("rami 7 tricks = x1", mult({ mode: "rami", ramTeam: 0, usTricks: 7 }), 1);
eq("rami 9 tricks = x3", mult({ mode: "rami", ramTeam: 0, usTricks: 9 }), 3);
eq("rami 13 tricks = x7", mult({ mode: "rami", ramTeam: 0, usTricks: 13 }), 7);
eq("ryosto 7 tricks = x2", mult({ mode: "rami", ramTeam: 1, usTricks: 7 }), 2);
eq("ryosto 9 tricks = x6", mult({ mode: "rami", ramTeam: 1, usTricks: 9 }), 6);
eq("nolo 6 tricks = x1", mult({ mode: "nolo", ramTeam: null, usTricks: 6 }), 1);
eq("nolo 3 tricks = x4", mult({ mode: "nolo", ramTeam: null, usTricks: 3 }), 4);
eq("nolo 0 tricks = x7", mult({ mode: "nolo", ramTeam: null, usTricks: 0 }), 7);
eq("nolo 7 tricks = collapsed", mult({ mode: "nolo", ramTeam: null, usTricks: 7 }), 0);
eq("a clean sooli = x6", mult({ sooli: true, usTricks: 0 }), 6);
eq("a busted sooli = 0", mult({ sooli: true, sooliBust: true, usTricks: 1 }), 0);

group("Tuppi multiplier: jokers, vouchers and boss");
const vanha = JOKERS.find(j => j.id === "vanhatuppi");
eq("Vanha Tuppi joker +1", mult({ mode: "rami", ramTeam: 0, usTricks: 7, jokers: [vanha] }), 2);
eq("Tuppisormus voucher +1", (reset({ mode: "rami", ramTeam: 0, usTricks: 7 }), G().tuppiBonus = 1, tuppiInfo().mult), 2);
eq("Kitsas kerroin boss -1", (reset({ mode: "rami", ramTeam: 0, usTricks: 9, boss: { id: "kitsas" } }), tuppiInfo().mult), 2);
eq("multiplier never drops below x1 when the tricks suffice",
  (reset({ mode: "rami", ramTeam: 0, usTricks: 7, boss: { id: "kitsas" } }), tuppiInfo().mult), 1);

/* ---------------- 7. scoring and enhancements ---------------- */
group("Scoring");
function score(cards, over) { reset(over); return scoreTrick(0, 0, cards); }
const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
const base = score(plain);
eq("flush: chips = 30 base + card values", base.chips, TYPES.flush.chips + 5 + 9 + 2 + 7);
eq("flush: mult = 2", base.mult, TYPES.flush.mult);
eq("total = chips x mult", base.total, base.chips * base.mult);
eq("bonus card +40 chips",
  score([C("H", 5, "bonus"), C("H", 9), C("H", 2), C("H", 7)]).chips - base.chips, 40);
eq("mult card +5 mult",
  score([C("H", 5, "mult"), C("H", 9), C("H", 2), C("H", 7)]).mult - base.mult, 5);
eq("glass card x2 chips",
  score([C("H", 5, "glass"), C("H", 9), C("H", 2), C("H", 7)]).chips, base.chips * 2);
near("steel card in hand x1.5 mult",
  (reset(), G().hands[0] = [C("D", 3, "steel")], scoreTrick(0, 0, plain).mult), base.mult * 1.5);
eq("steel card has no effect once played",
  (reset(), G().hands[0] = [], scoreTrick(0, 0, plain).mult), base.mult);
reset();
scoreTrick(0, 0, [C("H", 5, "gold"), C("H", 9), C("H", 2), C("H", 7)]);
eq("gold card +$3", G().money, 3);
eq("two gold cards +$6",
  (reset(), scoreTrick(0, 0, [C("H", 5, "gold"), C("H", 9, "gold"), C("H", 2), C("H", 7)]), G().money), 6);

group("Scoring: bosses");
eq("Punainen kielto zeroes red chips",
  (reset({ boss: { id: "punainen" } }), chipValue(C("H", 9))), 0);
eq("  blacks are unaffected", (reset({ boss: { id: "punainen" } }), chipValue(C("S", 9))), 9);
eq("Kasijarru: trick type gives no mult",
  score(plain, { boss: { id: "kasijarru" } }).mult, 1);

group("Scoring: joker order");
/* Additions before multipliers: purchase order must not change the result. */
const assa = JOKERS.find(j => j.id === "assa");        // x2 mult if an ace is present
const ramikone = JOKERS.find(j => j.id === "ramikone"); // +6 mult in rami
const withAce = [C("H", 14), C("H", 9), C("H", 2), C("H", 7)];
const orderA = score(withAce, { jokers: [assa, ramikone] }).mult;
const orderB = score(withAce, { jokers: [ramikone, assa] }).mult;
eq("purchase order does not change mult", orderA, orderB);
eq("  and the multiplier lands after the sum", orderA, (TYPES.flush.mult + 6) * 2);

group("Scoring: enhancement jokers");
eq("Kivenveistaja +70 chips per stone",
  score([C("S", 2, "stone"), C("H", 9), C("H", 2), C("H", 7)],
    { jokers: [JOKERS.find(j => j.id === "kivenveistaja")] }).chips -
  score([C("S", 2, "stone"), C("H", 9), C("H", 2), C("H", 7)]).chips, 70);
eq("Pakkamestari x0.2 per enhanced card in the side deck",
  (reset({ jokers: [JOKERS.find(j => j.id === "pakkamestari")] }),
    G().sideDeck = [C("S", 2, "stone"), C("H", 3, "gold")],
    scoreTrick(0, 0, plain).mult), TYPES.flush.mult * 1.4);

/* ---------------- 8. which side scores ---------------- */
group("Which side scores");
const forUs = (mode, winner, sooli) => (reset({ mode, sooli: !!sooli }), api.scoresForUs(winner));
ok("in rami you score the tricks you win", forUs("rami", 0) && forUs("rami", 2));
ok("  not the opponents'", !forUs("rami", 1) && !forUs("rami", 3));
ok("in nolo you score the ones you dodge", forUs("nolo", 1) && forUs("nolo", 3));
ok("  not your own tricks", !forUs("nolo", 0) && !forUs("nolo", 2));
ok("in sooli you score the dodged tricks", forUs("rami", 1, true) && !forUs("rami", 0, true));

/* ---------------- 9. deck and structure ---------------- */
group("Deck and structure");
reset();
const deck = api.makeDeck();
eq("the deck holds 52 cards", deck.length, 52);
eq("all individuals unique", new Set(deck.map(c => c.uid)).size, 52);
eq("all card types distinct", new Set(deck.map(c => c.id)).size, 52);
eq("8 antes", ANTES.length, 8);
ok("ante thresholds increase", ANTES.every((v, i) => i === 0 || v > ANTES[i - 1]));
eq("7 enhancements", Object.keys(ENH).length, 7);
ok("at least 20 jokers", JOKERS.length >= 20);
ok("jokers have unique ids", new Set(JOKERS.map(j => j.id)).size === JOKERS.length);
ok("jokers have a name, price and description",
  JOKERS.every(j => j.n && j.p > 0 && j.t && j.r));
ok("enhancements have a name, price and description",
  Object.keys(ENH).every(k => ENH[k].n && ENH[k].p > 0 && ENH[k].t && ENH[k].g));
eq("trick size is normally 4", (reset(), api.trickSize()), 4);
eq("trick size in sooli is 3", (reset({ sooli: true }), api.trickSize()), 3);
eq("the ace is lowest in sooli", (reset({ sooli: true }), rv(C("S", 14))), 1);
eq("  and highest otherwise", (reset(), rv(C("S", 14))), 14);

/* ---------------- 10. seeded randomness ---------------- */
group("Seeds and reproducibility");
const { setSeed, makeSeed, seedHash, rnd, newGame, rollShop, SEED_ALPHABET } = api;

function dealWith(seed) {
  reset();
  setSeed(seed);
  api.deal();
  return G().hands.map(h => h.map(c => c.id).join(",")).join("|");
}
const d1 = dealWith("TUPPI"), d2 = dealWith("TUPPI");
eq("the same seed produces the same deal", d1, d2);
ok("a different seed produces a different deal", dealWith("TUPPI") !== dealWith("NOLO"),
  "two different seeds produced the same deal");
eq("the deal still holds 52 cards", d1.split("|").join(",").split(",").length, 52);

eq("the seed is normalised to upper case", (reset(), setSeed("  tuppi  "), G().seed), "TUPPI");
eq("  and yields the same stream as the clean form", dealWith("  tuppi  "), dealWith("TUPPI"));
ok("an empty seed draws a new one", (reset(), setSeed(""), G().seed.length === 8));
ok("a generated seed uses only unambiguous characters",
  makeSeed().split("").every(ch => SEED_ALPHABET.indexOf(ch) >= 0));
ok("a generated seed avoids O/0/I/1", !/[O0I1]/.test(makeSeed() + makeSeed() + makeSeed()));

eq("seedHash is stable", seedHash("TUPPI"), seedHash("TUPPI"));
ok("seedHash separates seeds", seedHash("TUPPI") !== seedHash("TUPPJ"));

reset(); setSeed("RNGTEST");
const draws = Array.from({ length: 500 }, () => rnd());
ok("rnd stays within [0,1)", draws.every(v => v >= 0 && v < 1));
ok("rnd does not stick on one value", new Set(draws).size > 450);
reset(); setSeed("RNGTEST");
eq("rnd replays from the seed", Array.from({ length: 500 }, () => rnd()).join(","), draws.join(","));

/* The shop draws from the same stream, so it replays too. */
function shopWith(seed) {
  reset(); setSeed(seed); api.deal(); rollShop(true);
  return G().shop.map(i => i.kind + ":" + i.data.n).join(" | ");
}
eq("the shop stock replays from the seed", shopWith("KAUPPA"), shopWith("KAUPPA"));
ok("a different seed gives different stock", shopWith("KAUPPA") !== shopWith("KAUPPA2"));

/* newGame(seed) — and a guard that a click event cannot become the seed. */
newGame("OMASIEMEN");
eq("newGame accepts a seed", G().seed, "OMASIEMEN");
newGame();
ok("newGame without a seed draws one", G().seed.length === 8);
ok("game logic does not use Math.random", (m[1].match(/Math\.random/g) || []).length === 1,
  "found " + (m[1].match(/Math\.random/g) || []).length + " sites (only makeSeed is allowed)");
ok("newGame is not wired straight to onclick",
  !/onclick = newGame[^(]/.test(m[1]),
  "onclick = newGame would pass an Event object in as the seed");

/* ---------------- 11. file integrity ---------------- */
group("File integrity");
ok("charset is on the first line", html.startsWith('<meta charset="utf-8">'));
ok("exactly one <script> block", (html.match(/<script/g) || []).length === 1);
ok("exactly one <style> block", (html.match(/<style>/g) || []).length === 1);
ok("no external scripts", !/<script[^>]+src=/.test(html));
ok("no build-step leftovers", !/require\(|from ['"]\.|import \{/.test(m[1]));
ok("no mojibake", !/[ÃÂ][-¿]/.test(html));
const fontDecls = (html.match(/--font-[dbm]:[^;]+;/g) || []);
eq("three font variables", fontDecls.length, 3);
ok("every font has a fallback", fontDecls.every(d => d.split(",").length >= 2));

/* ---------------- summary ---------------- */
console.log("\n" + "-".repeat(50));
if (fail) {
  console.log("FAILED:");
  fails.forEach(f => console.log("  ✗ " + f));
}
console.log((fail ? "✗" : "✓") + " " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
