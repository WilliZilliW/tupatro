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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { Hand } from "../components/hand/Hand";
import { Rail } from "../components/rail/Rail";
import { Scoreboard } from "../components/screens/Scoreboard";
import { Screens } from "../components/screens/Screens";
import { Table } from "../components/table/Table";
import { Toasts } from "../components/Toasts";
import { App } from "../App";
import { JOKERS, CONSUMABLES, VOUCHERS, PARTIES } from "../game/content";
import { partyOf } from "../game/cards";
import { PlayingCard } from "../components/PlayingCard";
import { LOCALE_ORDER, emblemOfIn, formatNumber, translateList } from "../i18n";
import { fi } from "../i18n/fi";
import { loadedState, renderWith } from "./harness";
import { card } from "./factories";
import { addScore, rowFor } from "../game/scores";
import { writeScores } from "../game/storage";
import type { ScoreRow } from "../game/scores";
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
  /* The catalogue marks a word with <b>; React escapes a string, so a tag
     reaching textContent means the string skipped <Rich>. */
  expect(text, `${label} [${locale}] printed markup as text`).not.toMatch(/<\/?[a-z]+>/);
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

/* A full board: every blind, a won run and a lost one, and scores large enough
   that the thousands separator differs per language. */
const BOARD: ScoreRow[] = Array.from({ length: 10 }, (_, i) => ({
  seed: `SEED${i}`,
  ante: 8 - i,
  blindIdx: i % 3,
  runScore: 90000 - i * 7777,
  won: i === 0,
  at: 1700000000000 + i,
}));

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
  ["the scoreboard", () => loadedState(), () => <Scoreboard rows={BOARD} />],
  ["an empty scoreboard", () => loadedState(), () => <Scoreboard rows={[]} />],
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
      /* sideDeck[0] has its twin in hand, so the targets light up. */
      const g = loadedState({ phase: "swap" });
      return { ...g, swapPick: g.sideDeck[0] };
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
    "the support plate",
    () =>
      loadedState({
        support: Object.fromEntries(PARTIES.map((p, i) => [p.id, i * 137])),
      }),
    () => <Rail />,
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

  /* The emblem is asserted against the element, not against the card's text:
     a one- or two-character code is a substring of an ace of spades' own face
     ("A", "♠", "+11"), so a text search would pass with the span deleted. */
  it.each([
    ["an ordinary card", card("H", 7), false],
    ["a stone card in the tuppipakka", card("S", 14, "stone"), true],
    ["a stone card on the felt", card("S", 14, "stone"), false],
  ])("prints the party emblem on %s", (_label, c, twin) => {
    const g = loadedState();
    const party = PARTIES.find((p) => p.id === partyOf(g, c));
    const expected = party && emblemOfIn(locale, party);
    const { container } = renderWith(g, <PlayingCard card={c} twin={twin} />, locale);
    /* emblemOfIn returns the key itself when the catalogue is missing it, so a
       defined check would pass on "party.kahvi.g". */
    expect(expected).toMatch(/^[A-Z0-9]{1,2}$/);
    expect(container.querySelector(".pemblem")?.textContent).toBe(expected);
  });

  /* The emblem is not the pair. A stone card on the felt still hides the suit
     and rank it swaps in for — which is what could be mistaken for a suit it
     could follow — while the party, which follows nothing, stays on the face. */
  it("prints the party emblem on a stone card without printing its pair", () => {
    const c = card("S", 14, "stone");
    const { container } = renderWith(loadedState(), <PlayingCard card={c} />, locale);
    expect(container.querySelector(".card.e-stone")).not.toBeNull();
    expect(container.querySelector(".pemblem")).not.toBeNull();
    expect(container.querySelector(".twin")).toBeNull();
  });

  it("shows every party in the rail, in the fixed PARTIES order", () => {
    /* A map hostile to sorting: the last party leads, the first has none. */
    const support = Object.fromEntries(PARTIES.map((p, i) => [p.id, i]));
    const { container } = renderWith(loadedState({ support }), <Rail />, locale);
    const rows = container.querySelectorAll(".supportrow");
    expect(rows).toHaveLength(13);
    expect([...rows].map((r) => r.querySelector(".pbadge")?.textContent)).toEqual(
      PARTIES.map((p) => emblemOfIn(locale, p)),
    );
  });

  it("groups the support counts per language", () => {
    const support = { ...Object.fromEntries(PARTIES.map((p) => [p.id, 0])), [PARTIES[3].id]: 1616 };
    const { container } = renderWith(loadedState({ support }), <Rail />, locale);
    const num = container.querySelectorAll(".supportrow")[3].querySelector(".pnum")?.textContent;
    expect(num).toBe(formatNumber(locale, 1616));
    if (locale === "fi") expect(num).not.toBe("1616");
  });

  /* tList returns [] for an unknown key, so a typo in the key would render an
     empty section that every other assertion here would pass. */
  it("lists the parties in the rules panel", () => {
    const { container } = renderWith(loadedState({ modal: "rules" }), <Screens />, locale);
    const lists = container.querySelectorAll(".rules ul");
    const last = lists[lists.length - 1];
    expect(last.querySelectorAll("li")).toHaveLength(translateList(locale, "rules.parties").length);
    expect(last.querySelectorAll("li").length).toBeGreaterThan(0);
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

/* The board on the end screens is read from the store at render time and the
   run that just ended is merged in, because the provider's effect has not run
   yet on the commit that first shows the screen. jsdom provides no Storage, so
   these install one. */
describe("the end screens show the run that just ended", () => {
  const STORED: ScoreRow[] = [
    { seed: "OLD1", ante: 8, blindIdx: 2, runScore: 50000, won: true, at: 1 },
    { seed: "OLD2", ante: 5, blindIdx: 1, runScore: 20000, won: false, at: 2 },
    { seed: "OLD3", ante: 2, blindIdx: 0, runScore: 900, won: false, at: 3 },
  ];

  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    } satisfies Storage);
    writeScores(STORED);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const seedsOn = (root: Element) =>
    [...root.querySelectorAll(".scorerow .sseed")].map((e) => e.textContent);

  it("draws it beside the stored rows", () => {
    const g = loadedState({ screen: { kind: "gameover" } });
    const { container } = renderWith(g, <Screens />);
    expect(seedsOn(container)).toHaveLength(4);
    expect(seedsOn(container)).toContain(g.seed);
  });

  it("does not draw it twice when the provider already wrote it", () => {
    const g = loadedState({ screen: { kind: "victory" } });
    /* The provider's row, with a timestamp the screen cannot guess: the merge
       collapses it all the same. */
    writeScores(addScore(STORED, rowFor(g, true, 12345)));
    const { container } = renderWith(g, <Screens />);
    expect(seedsOn(container)).toHaveLength(4);
    expect(seedsOn(container).filter((s) => s === g.seed)).toHaveLength(1);
  });
});

/* The hand row is a scroller on a phone, where .hcard gives the pan back to
   the browser (touch-action:pan-x). The browser then cancels the pointer once
   it takes the gesture over, and it does that after delivering moves through
   its own scroll slop — so the drag can already be in flight when the cancel
   arrives. Which of the two endings runs is the whole difference between
   panning the row and rearranging the hand. */
describe("the hand drag", () => {
  function dragFirstCard(cancelled: boolean) {
    const rendered = renderWith(loadedState({ phase: "play", turn: 0 }), <Hand />);
    const cards = Array.from(rendered.container.querySelectorAll<HTMLElement>(".hcard"));
    const first = cards[0];
    fireEvent.pointerDown(first, { pointerId: 1, clientX: 0, button: 0 });
    fireEvent.pointerMove(first, { pointerId: 1, clientX: 40 });
    if (cancelled) fireEvent.pointerCancel(first, { pointerId: 1 });
    else fireEvent.pointerUp(first, { pointerId: 1, clientX: 40 });
    return { ...rendered, uids: cards.map((c) => c.dataset.uid) };
  }

  it("commits the new order when the pointer is released", () => {
    const { dispatch, uids } = dragFirstCard(false);
    /* jsdom gives every card a zero rect, so the dragged card lands last. */
    expect(dispatch).toHaveBeenCalledWith({
      type: "reorderHand",
      uids: [...uids.slice(1), uids[0]],
    });
  });

  it("discards it when the browser takes the gesture over", () => {
    const { dispatch, container } = dragFirstCard(true);
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain("reorderHand");
    expect(container.querySelector(".dragging")).toBeNull();
  });

  it("leaves the next tap playable after a cancelled drag", () => {
    /* No click follows a pointercancel, so the suppression flag the drag set
       has to be cleared with it or the tap after the pan is eaten. */
    const { dispatch, container } = dragFirstCard(true);
    const first = container.querySelector<HTMLElement>(".hcard");
    if (first) fireEvent.click(first);
    expect(dispatch.mock.calls.map(([a]) => a.type)).toContain("playCard");
  });
});
