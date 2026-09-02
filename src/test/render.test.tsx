/* The render test.
 *
 * The unit tests cover the rules; without this, nothing covers the rendering,
 * and a whole class of bug slips through: when a field moves or is renamed, the
 * UI keeps reading the property that no longer exists and quietly prints
 * "undefined". String-literal scans cannot see it, because a property access is
 * not a literal.
 *
 * So: draw every panel in both languages and assert that nothing reads
 * "undefined", that no untranslated key leaks through, and that no Finnish is
 * left in the English view.
 *
 * Extend the word list rather than trusting a grep. */
import { describe, expect, it } from "vitest";
import { Hand } from "../components/hand/Hand";
import { Rail } from "../components/rail/Rail";
import { Screens } from "../components/screens/Screens";
import { Table } from "../components/table/Table";
import { Toasts } from "../components/Toasts";
import { App } from "../App";
import { JOKERS, CONSUMABLES, VOUCHERS } from "../game/content";
import { LOCALE_ORDER } from "../i18n";
import { fi } from "../i18n/fi";
import { loadedState, renderWith } from "./harness";
import { card } from "./factories";
import type { GameState, Phase, ShopItem } from "../game/types";
import type { Locale } from "../i18n";

/* Words that never belong in the English view. Deliberately excludes the
   tuppi terms and the characters' names, which stay Finnish in both languages,
   and any word that is also English ("on", "sail"...). Diacritics are not
   enough on their own: "palkkio", "tavoite", "Panos" and "Temput" all survived
   three separate ä/ö sweeps. */
const FINNISH =
  /\b(panos|panoksen|panosta|tikki|tikkiä|tikkejä|jako|jakoa|jakoja|kortti|korttia|kortit|kassa|tavoite|palkkio|temput|temppu|jokerit|jokeria|rahaa|valitse|ohjeet|pisteet|kerroin|vaihtoa|vaihdot|siemen|maata|kädestä|käsi|jotta|joten|että|mutta|kaikki|uusi peli|ilman|kanssa|jälkeen|ennen|yksin|pelaa|pelaat|voitat|saat|näet|sanoi|pataa|herttaa|ruutua|ristiä)\b/i;

/* An untranslated key, e.g. "joker.ramikone.n" or "rail.money". Compared
   against the real catalogue rather than a pattern: a pattern also matched
   ordinary prose ("...blind." + "SIDE DECK"), and a brittle test is worse than
   no test. */
const KEYS = new Set(Object.keys(fi));

function leakedKey(text: string): string | undefined {
  for (const m of text.matchAll(/\b[a-z][A-Za-z]*(?:\.[A-Za-z]\w*)+/g))
    if (KEYS.has(m[0])) return m[0];
  return undefined;
}

function check(label: string, locale: Locale, text: string) {
  expect(text, `${label} [${locale}] printed "undefined"`).not.toMatch(/undefined/);
  expect(text, `${label} [${locale}] printed "[object Object]"`).not.toMatch(/\[object Object\]/);
  expect(text, `${label} [${locale}] printed NaN`).not.toMatch(/\bNaN\b/);
  expect(leakedKey(text), `${label} [${locale}] leaked an untranslated key`).toBeUndefined();
  if (locale === "en") {
    const fin = text.match(FINNISH);
    expect(fin?.[0], `${label} [${locale}] left Finnish in English output`).toBeUndefined();
  }
}

const SHOP: ShopItem[] = [
  { kind: "joker", data: JOKERS[2], price: 5, sold: false },
  { kind: "voucher", data: VOUCHERS[1], price: 9, sold: false },
  { kind: "consumable", data: CONSUMABLES[2], price: 4, sold: true },
  {
    kind: "card",
    data: {
      id: "card-goldH7",
      key: "enh.gold",
      g: "$",
      p: 5,
      cardLabel: "7♥",
      card: { s: "H", r: 7, enh: "gold" },
    },
    price: 5,
    sold: false,
  },
];

/* Every view and panel, in the state that opens it. */
const VIEWS: Array<[string, () => GameState, () => React.ReactNode]> = [
  ["the whole app", () => loadedState(), () => <App />],
  ["the rail", () => loadedState(), () => <Rail />],
  ["the table and hand", () => loadedState(), () => [<Table key="t" />, <Hand key="h" />]],
  ["the blind select", () => loadedState({ screen: { kind: "blindselect" } }), () => <Screens />],
  ["the rules panel", () => loadedState({ modal: "rules" }), () => <Screens />],
  ["the seed dialog", () => loadedState({ modal: "seed" }), () => <Screens />],
  ["the restart confirmation", () => loadedState({ modal: "restart" }), () => <Screens />],
  [
    "the shop",
    () => loadedState({ screen: { kind: "shop" }, shop: SHOP, shopAfterBoss: true }),
    () => <Screens />,
  ],
  [
    "the deal-end screen",
    () => loadedState({ screen: { kind: "dealend", score: 420 } }),
    () => <Screens />,
  ],
  [
    "the cash-out screen",
    () =>
      loadedState({
        screen: {
          kind: "cashout",
          score: 1200,
          reward: 4,
          bonus: 3,
          interest: 2,
          spare: 1,
          bank: 26,
        },
      }),
    () => <Screens />,
  ],
  ["the game-over screen", () => loadedState({ screen: { kind: "gameover" } }), () => <Screens />],
  ["the victory screen", () => loadedState({ screen: { kind: "victory" } }), () => <Screens />],
  [
    "the declaration panel",
    () => loadedState({ phase: "declare", declSeq: [0, 1, 2, 3], declIdx: 1 }),
    () => <Table />,
  ],
  [
    "the declaration panel under Pakkorami",
    () =>
      loadedState({
        phase: "declare",
        declSeq: [0, 1, 2, 3],
        declIdx: 0,
        boss: { id: "pakkorami", key: "boss.pakkorami" },
      }),
    () => <Table />,
  ],
  [
    "the side-deck swap panel",
    () => loadedState({ phase: "swap" }),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the swap panel with a card picked",
    () => {
      const g = loadedState({ phase: "swap" });
      return { ...g, swapPick: g.sideDeck[0], usedSide: [g.sideDeck[1].uid] };
    },
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  ["the sooli offer", () => loadedState({ phase: "soolioffer" }), () => <Table />],
  ["the sooli give step", () => loadedState({ phase: "sooligive", sooli: true }), () => <Hand />],
  [
    "the sooli ready step",
    () =>
      loadedState({
        phase: "sooliready",
        sooli: true,
        sooliExchange: { gave: card("S", 13), got: card("D", 2) },
      }),
    () => <Table />,
  ],
  [
    "a scored trick",
    () =>
      loadedState({
        phase: "trickend",
        winSeat: 1,
        trick: [
          { p: 0, card: card("H", 5) },
          { p: 1, card: card("H", 13) },
          { p: 2, card: card("S", 2, "stone") },
          { p: 3, card: card("H", 4) },
        ],
        pop: { typeId: "pair", chips: 88, mult: 2.5, times: 2, total: 440, dodged: true },
      }),
    () => <Table />,
  ],
  [
    "the nolo table with revealed hands",
    () => loadedState({ mode: "nolo", ramSeat: null, ramTeam: null, reveal: true }),
    () => <Table />,
  ],
  [
    "an empty run",
    () =>
      loadedState({
        jokers: [],
        consumables: [],
        vouchers: [],
        sideDeck: [],
        boss: null,
        mode: null,
        shows: [null, null, null, null],
      }),
    () => <Rail />,
  ],
];

describe.each(LOCALE_ORDER)("rendering (%s)", (locale) => {
  it.each(VIEWS)("renders %s", (label, state, ui) => {
    const { container } = renderWith(state(), ui(), locale);
    check(label, locale, container.textContent ?? "");
  });

  /* Toasts are carried as a key; the suit is inflected separately. */
  it("renders every toast shape", () => {
    const toasts: GameState["toast"][] = [
      { id: 1, key: "toast.mustFollow", suit: "C" },
      { id: 2, key: "toast.soldJoker", vars: { amount: 3 }, nameKey: JOKERS[0].key },
      { id: 3, key: "toast.swapped", vars: { from: "A♠", to: "2♦" } },
      { id: 4, key: "toast.onlyBeforeFirstTrick", nameKey: CONSUMABLES[0].key },
      { id: 5, key: "toast.peeked" },
    ];
    for (const toast of toasts) {
      const { container, unmount } = renderWith(loadedState({ toast }), <Toasts />, locale);
      const text = container.textContent ?? "";
      expect(text.length, `toast ${toast?.key} rendered empty`).toBeGreaterThan(0);
      expect(text).not.toMatch(/\{|\}/);
      check(`toast ${toast?.key}`, locale, text);
      unmount();
    }
  });

  /* Every phase draws. A new phase that nobody handles shows up here rather
     than in the browser. */
  const PHASES: Phase[] = [
    "blindselect",
    "swap",
    "declare",
    "soolioffer",
    "sooligive",
    "sooliready",
    "play",
    "resolve",
    "trickend",
    "handend",
    "shop",
  ];

  it.each(PHASES)("handles the %s phase", (phase) => {
    const { container } = renderWith(
      loadedState({
        phase,
        declSeq: [0, 1, 2, 3],
        declIdx: 0,
        sooliExchange: { gave: card("S", 13), got: card("D", 2) },
      }),
      [<Table key="t" />, <Hand key="h" />],
      locale,
    );
    check(`phase ${phase}`, locale, container.textContent ?? "");
  });

  /* Every phase where the player acts says what is expected of them. */
  it.each(["swap", "declare", "sooligive", "sooliready", "play"] as Phase[])(
    "tells the player what to do in the %s phase",
    (phase) => {
      const { container } = renderWith(loadedState({ phase, turn: 0 }), <Hand />, locale);
      expect(container.querySelector(".hint")?.textContent ?? "").not.toBe("");
    },
  );
});
