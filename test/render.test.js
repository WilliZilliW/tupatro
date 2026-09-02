/* Render smoke test.
 *
 * The unit tests cover the rules; nothing covered the rendering, and a whole
 * class of bug slips through as a result: when a field moves (joker names went
 * from j.n to the locale catalogue), the UI keeps reading the old property and
 * quietly prints "undefined". String-literal scans cannot see that, because
 * `j.n` is a property access, not a string.
 *
 * So: stub just enough DOM, render every panel, and assert that nothing in the
 * output reads "undefined" or "null".
 */
import { group, ok } from "./harness.js";

/* ---------------- DOM stub ---------------- */
const nodes = [];
function makeEl(id) {
  const el = {
    id: id || "",
    _html: "",
    textContent: "",
    className: "",
    title: "",
    dataset: {},
    style: {},
    children: [],
    scrollWidth: 0,
    clientWidth: 0,
    classList: { add() {}, remove() {}, contains: () => false },
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    insertBefore(c) {
      this.children.push(c);
      return c;
    },
    removeChild() {},
    remove() {},
    addEventListener() {},
    setPointerCapture() {},
    focus() {},
    select() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    click() {},
  };
  Object.defineProperty(el, "innerHTML", {
    get() {
      return this._html;
    },
    set(v) {
      this._html = String(v);
    },
  });
  nodes.push(el);
  return el;
}
const byId = new Map();
globalThis.document = {
  getElementById(id) {
    if (!byId.has(id)) byId.set(id, makeEl(id));
    return byId.get(id);
  },
  createElement: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  body: makeEl("body"),
  documentElement: makeEl("html"),
};
globalThis.localStorage = {
  _d: {},
  getItem(k) {
    return k in this._d ? this._d[k] : null;
  },
  setItem(k, v) {
    this._d[k] = String(v);
  },
};
/* navigator is getter-only in modern Node, so define rather than assign. */
if (!globalThis.navigator) {
  Object.defineProperty(globalThis, "navigator", { value: { language: "fi" }, configurable: true });
}
globalThis.window = { setTimeout: () => 0, clearTimeout: () => {} };

/* Namespace import, not destructuring: newGame() reassigns G, and destructuring
   would capture the old value. */
const state = await import("../src/state.js");
const { newGame } = state;
const { render } = await import("../src/ui/render.js");
const screens = await import("../src/ui/screens.js");
const { setLocale, getLocale } = await import("../src/i18n.js");
const { JOKERS, CONSUMABLES, VOUCHERS, BOSSES } = await import("../src/content.js");
const { mkCard } = await import("../src/cards.js");
const { deal } = await import("../src/flow.js");

/* Collect everything the UI has written, from both the id-addressed elements and
   any nodes it created along the way. */
function rendered() {
  return [...byId.values(), ...nodes]
    .map((n) => (n._html || "") + " " + (n.textContent || "") + " " + (n.title || ""))
    .join("\n");
}
function clear() {
  for (const n of [...byId.values(), ...nodes]) {
    n._html = "";
    n.textContent = "";
    n.title = "";
  }
}
function check(label, fn) {
  clear();
  let threw = null;
  try {
    fn();
  } catch (e) {
    threw = e;
  }
  ok(`${label} renders without throwing`, !threw, threw && threw.message);
  const out = rendered();
  ok(`${label} prints no "undefined"`, !/undefined/.test(out), snippet(out, "undefined"));
  ok(`${label} prints no "[object Object]"`, !/\[object Object\]/.test(out));
  ok(
    `${label} prints no untranslated key`,
    !/\b(joker|enh|cons|voucher|boss|rail|btn)\.\w+\.?\w*\b/.test(out),
    snippet(out, "\\w+\\.\\w+"),
  );
  if (getLocale() === "en") {
    const m = out.match(FINNISH);
    ok(`${label} leaves no Finnish in English`, !m, m && snippet(out, m[0]));
  }
}
/* Words that must never appear in English output. Deliberately excludes the
   tuppi terms and the characters' names, which stay Finnish in both languages,
   and any word that is also English ("on", "sail"...). Diacritics are not
   enough on their own: "palkkio", "tavoite", "Panos" and "Temput" all slipped
   through three separate ä/ö-based sweeps. */
const FINNISH =
  /\b(panos|panoksen|panosta|tikki|tikkiä|tikkejä|jako|jakoa|jakoja|kortti|korttia|kortit|kassa|tavoite|palkkio|temput|temppu|jokerit|jokeria|rahaa|valitse|ohjeet|pisteet|kerroin|vaihtoa|vaihdot|siemen|maata|kädestä|käsi|jotta|joten|että|mutta|kaikki|uusi peli|ilman|kanssa|jälkeen|ennen|yksin|pelaa|pelaat|voitat|saat|näet)\b/i;

function snippet(out, pattern) {
  const m = out.match(new RegExp(".{0,45}" + pattern + ".{0,25}"));
  return m ? m[0].replace(/\s+/g, " ") : "";
}

/* A run with something in every slot, so no branch renders an empty list. */
function loaded() {
  const g = newGame("RENDERTEST");
  g.jokers = [JOKERS[0], JOKERS[7], JOKERS[JOKERS.length - 1]];
  g.consumables = [CONSUMABLES[0], CONSUMABLES[1]];
  g.vouchers = [VOUCHERS[0].id];
  g.sideDeck = [mkCard("S", 2, "stone"), mkCard("H", 14, "wild")];
  g.boss = BOSSES[0];
  g.target = 1000;
  g.blindScore = 250;
  g.mode = "rami";
  g.ramSeat = 1;
  g.ramTeam = 1;
  g.shows = [
    { decl: "nolo", card: mkCard("S", 5) },
    { decl: "rami", card: mkCard("H", 6) },
    { decl: "nolo", card: mkCard("C", 7) },
    { decl: "nolo", card: mkCard("D", 8) },
  ];
  deal();
  g.phase = "play";
  g.turn = 0;
  return g;
}

for (const loc of ["fi", "en"]) {
  group(`Rendering (${loc})`);
  setLocale(loc);

  loaded();
  check("the rail, table and hand", () => render());

  loaded();
  check("the rules panel", () => screens.showRules());

  loaded();
  check("the blind select", () => screens.showBlindSelect());

  loaded();
  state.G.shop = [
    { kind: "joker", data: JOKERS[2], price: 5, sold: false },
    { kind: "voucher", data: VOUCHERS[1], price: 9, sold: false },
    { kind: "consumable", data: CONSUMABLES[2], price: 4, sold: true },
  ];
  check("the shop", () => screens.showShop());

  loaded();
  check("the seed dialog", () => screens.showSeedDialog());

  loaded();
  check("the deal-end screen", () => screens.showDealEnd(420));

  loaded();
  check("the cash-out screen", () => screens.showCashOut(1200));

  loaded();
  check("the game-over screen", () => screens.showGameOver());

  loaded();
  check("the victory screen", () => screens.showVictory());

  loaded();
  check("the declaration panel", () => {
    state.G.declSeq = [0, 1, 2, 3];
    state.G.declIdx = 1;
    screens.askDeclaration();
  });

  loaded();
  check("the side-deck swap panel", () => screens.renderSwapPanel());

  loaded();
  check("the sooli offer", () => screens.offerSooli());
}
