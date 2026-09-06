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
import { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Hand } from "../components/hand/Hand";
import { Rail } from "../components/rail/Rail";
import { Scoreboard } from "../components/screens/Scoreboard";
import { Screens } from "../components/screens/Screens";
import { Table } from "../components/table/Table";
import { Toasts } from "../components/Toasts";
import { App } from "../App";
import { BOSSES, JOKERS, CONSUMABLES, VOUCHERS, PARTIES, ENH } from "../game/content";
import { ANTES } from "../game/constants";
import { cardName, partyOf } from "../game/cards";
import { swapTargets } from "../game/rules";
import { PlayingCard } from "../components/PlayingCard";
import {
  LOCALE_ORDER,
  descOfIn,
  emblemOfIn,
  formatNumber,
  nameOfIn,
  translate,
  translateList,
} from "../i18n";
import { fi } from "../i18n/fi";
import { GameDispatchContext, GameStateContext } from "../hooks/gameContexts";
import { useGameState } from "../hooks/useGame";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { loadedState, renderWith } from "./harness";
import { card } from "./factories";
import { gameReducer } from "../game/reducer";
import { addScore, rowFor } from "../game/scores";
import { writeScores } from "../game/storage";
import type { ScoreRow } from "../game/scores";
import type { GameState, Phase, Screen, ShopItem } from "../game/types";
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

/* The same shelf with nothing sold, so the consumable offer can be bought
   into a full trick slot. */
const REPLACE_SHOP: ShopItem[] = SHOP.map((it) => ({ ...it, sold: false }));

/* A full board: every blind, a won run and a lost one, and scores large enough
   that the thousands separator differs per language. */
const BOARD: ScoreRow[] = Array.from({ length: 10 }, (_, i) => ({
  seed: `SEED${i}`,
  ante: 10 - i,
  blindIdx: i % 4,
  runScore: 90000 - i * 7777,
  won: i === 0,
  at: 1700000000000 + i,
}));

/* The sweep renders once and never interacts, but the swap infobox exists
   only while a side-deck card is selected, and the selection is component-local
   state a fixture cannot set. Clicking the card as the panel mounts makes a
   selected panel an ordinary fixture. */
function SideCardSelected({ index }: { index: number }) {
  const uid = useGameState().sideDeck[index].uid;
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`.sidecard[data-uid="${uid}"]`);
    /* Throwing rather than optional-chaining past the miss: without the card
       the fixture would quietly render an unselected panel that two older
       fixtures already sweep, and a vacuous pass is worse than no test. */
    if (!el) throw new Error(`no .sidecard with data-uid ${uid}`);
    el.click();
  }, [uid]);
  return (
    <>
      <Table />
      <Hand />
    </>
  );
}

/* The replace picker opens on a click too, and the pending offer is state in
   Shop.tsx. The wrapper clicks the offer's own button as the shop mounts, then
   checks on the next pass that the picker really replaced the shelf — a fixture
   that swept the shelf a second time would pass check() vacuously. */
function ShopReplacing({ index }: { index: number }) {
  const clicked = useRef(false);
  useEffect(() => {
    if (!clicked.current) {
      const el = document.querySelectorAll<HTMLElement>(".shelf .buy")[index];
      if (!el) throw new Error(`no shelf button at ${index}`);
      clicked.current = true;
      el.click();
      return;
    }
    if (!document.querySelector(".replacepick")) throw new Error(`offer ${index} opened no picker`);
  });
  return <Screens />;
}

/* A reroll under an open picker: the state the shop reads changes while the
   component stays mounted. The inner provider wins over the harness's, so the
   move needs no second render tree — and the trigger is a real button, because
   a state setter reached from outside the tree would not run inside React's
   act(). */
function Restocked({ before, after }: { before: GameState; after: GameState }) {
  const [g, setG] = useState(before);
  return (
    <GameStateContext.Provider value={g}>
      <button className="restock" onClick={() => setG(after)} />
      <Screens />
    </GameStateContext.Provider>
  );
}

/* Every view and panel, in the state that opens it. */
const VIEWS: Array<[string, () => GameState, () => React.ReactNode]> = [
  ["the whole app", () => loadedState(), () => <App />],
  ["the rail", () => loadedState(), () => <Rail />],
  ["the table and hand", () => loadedState(), () => [<Table key="t" />, <Hand key="h" />]],
  ["the blind select", () => loadedState({ screen: { kind: "blindselect" } }), () => <Screens />],
  [
    "the blind select at the big boss",
    () =>
      loadedState({
        screen: { kind: "blindselect" },
        blindIdx: 3,
        beaten: [true, true, true, false],
      }),
    () => <Screens />,
  ],
  [
    "the start menu with a run to return to",
    () => loadedState({ menu: "start", runStarted: true }),
    () => <Screens />,
  ],
  [
    "the start menu with no run yet",
    () => loadedState({ menu: "start", runStarted: false }),
    () => <Screens />,
  ],
  ["the challenges list", () => loadedState({ menu: "challenges" }), () => <Screens />],
  ["the rules panel", () => loadedState({ modal: "rules" }), () => <Screens />],
  ["the seed dialog", () => loadedState({ modal: "seed" }), () => <Screens />],
  ["the restart confirmation", () => loadedState({ modal: "restart" }), () => <Screens />],
  ["the scores modal", () => loadedState({ modal: "scores" }), () => <Screens />],
  [
    "the shop",
    () => loadedState({ screen: { kind: "shop" }, shop: SHOP, shopAfterBoss: true }),
    () => <Screens />,
  ],
  [
    "the shop replacing a joker",
    () => loadedState({ screen: { kind: "shop" }, shop: REPLACE_SHOP, money: 20, jokerSlots: 3 }),
    () => <ShopReplacing index={0} />,
  ],
  [
    "the shop replacing a tuppipakka card",
    () => loadedState({ screen: { kind: "shop" }, shop: REPLACE_SHOP, money: 20, sideSlots: 2 }),
    () => <ShopReplacing index={3} />,
  ],
  [
    /* loadedState already fills the trick slots (2 of 2). */
    "the shop replacing a trick",
    () => loadedState({ screen: { kind: "shop" }, shop: REPLACE_SHOP, money: 20 }),
    () => <ShopReplacing index={2} />,
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
    "the swap panel with a swap already spent",
    () => {
      /* sideDeck[0] has its twin in hand, so the panel draws a used card
         beside the ones still available. */
      const g = loadedState({ phase: "swap" });
      return { ...g, usedSide: [g.sideDeck[0].uid], swapsLeft: g.swapsLeft - 1 };
    },
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the swap panel with an available card selected",
    () => loadedState({ phase: "swap" }),
    () => <SideCardSelected index={0} />,
  ],
  [
    /* sideDeck[1]'s twin was dealt to another seat, so this draws the reason
       line as well as the infobox. */
    "the swap panel with an unavailable card selected",
    () => loadedState({ phase: "swap" }),
    () => <SideCardSelected index={1} />,
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

  /* Every boss draws its own name and note in the rail. A typo in a catalogue
     key leaks the key itself, and an English row built from a Finnish word
     fails the stopword check inside `check`. */
  it.each(BOSSES.map((b) => [b.id, b] as const))("names the boss %s", (_id, boss) => {
    const { container } = renderWith(loadedState({ boss }), <Rail />, locale);
    const text = container.textContent ?? "";
    check(`boss ${boss.id}`, locale, text);
    expect(text).toContain(nameOfIn(locale, boss));
    expect(text).toContain(descOfIn(locale, boss));
  });

  /* An ante now holds two boss blinds, and the rail has to tell them apart:
     one shared label would leave the small boss and the big one reading the
     same, and the plate is the only place the difference is shown. */
  it("names the small boss blind and the big one differently", () => {
    const labelAt = (blindIdx: number) => {
      const { container } = renderWith(loadedState({ blindIdx }), <Rail />, locale);
      return container.querySelector(".blindplate .lbl")?.textContent ?? "";
    };
    expect(labelAt(2)).toBe(translate(locale, "rail.bossSmall"));
    expect(labelAt(3)).toBe(translate(locale, "rail.bossBig"));
    expect(labelAt(2)).not.toBe(labelAt(3));
  });

  /* The denominator is the length of the ladder, not an 8 written into the
     catalogue: a missing {total} would print the placeholder itself. */
  it("prints the ante over the length of the ladder", () => {
    const { container } = renderWith(loadedState({ ante: 7 }), <Rail />, locale);
    const text = container.textContent ?? "";
    expect(text).toContain(translate(locale, "rail.ante", { n: 7, total: ANTES.length }));
    expect(text).not.toMatch(/[{}]/);
  });

  /* Four blinds to an ante, and neither boss blind can be skipped — the button
     the reducer would refuse is not drawn either. */
  it.each([0, 1, 2, 3])("draws four blinds and the right skip button at %i", (blindIdx) => {
    const { container } = renderWith(
      loadedState({ screen: { kind: "blindselect" }, blindIdx }),
      <Screens />,
      locale,
    );
    expect(container.querySelectorAll(".bcard")).toHaveLength(4);
    const skip = [...container.querySelectorAll<HTMLElement>("button")].filter(
      (b) => b.textContent === translate(locale, "btn.skip"),
    );
    expect(skip).toHaveLength(blindIdx < 2 ? 1 : 0);
  });

  /* The same ladder length on the screen that ends the run. Asserted on the
     printed pair, so an 8 left in the template fails here rather than telling
     the player their run stopped one ante from the top. */
  it("prints the run's ante over the length of the ladder when it ends", () => {
    const { container } = renderWith(
      loadedState({ screen: { kind: "gameover" }, ante: 7 }),
      <Screens />,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(`7/${ANTES.length}`);
    expect(text).not.toContain("7/8");
  });

  /* Under Kiire the blind allots three deals, and the game-over line has to say
     three: g.deals is the run's allowance and stays at four. */
  it("reports the deals the blind allotted on the game-over screen", () => {
    const g = loadedState({ screen: { kind: "gameover" }, deals: 4, blindDeals: 3 });
    const { container } = renderWith(g, <Screens />, locale);
    const text = container.textContent ?? "";
    expect(text).toContain(translate(locale, "over.allDealsPlayed", { deals: 3 }));
    expect(text).not.toContain(translate(locale, "over.allDealsPlayed", { deals: 4 }));
  });

  /* The footer holds three buttons now. Found by its label rather than by
     index, so a reordered footer still tests the right one. */
  it("opens the scoreboard from the rail", () => {
    const { container, dispatch } = renderWith(loadedState(), <Rail />, locale);
    const buttons = [...container.querySelectorAll<HTMLElement>(".railbtns button")];
    expect(buttons).toHaveLength(3);
    const scores = buttons.filter((b) => b.textContent === translate(locale, "btn.scores"));
    expect(scores).toHaveLength(1);
    fireEvent.click(scores[0]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "openModal", modal: "scores" });
  });

  /* The menu is the whole way into the game, so its buttons are asserted by
     label and in order: the column is a decision list and Continue is the one
     a returning player reaches for first. */
  const menuBtns = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLElement>(".menubtns button"),
  ];

  it("draws the menu's five buttons in order when there is a run to return to", () => {
    const g = loadedState({ menu: "start", runStarted: true });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const btns = menuBtns(container);
    expect(btns.map((b) => b.textContent)).toEqual([
      translate(locale, "btn.continue"),
      translate(locale, "btn.newGame"),
      translate(locale, "btn.challenges"),
      translate(locale, "btn.rules"),
      translate(locale, "btn.scores"),
    ]);
    fireEvent.click(btns[0]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "closeMenu" });
  });

  /* Continue is checked against both catalogues: a button labelled from the
     other language would still be a Continue leading nowhere. */
  it("offers no Continue before a run has started", () => {
    const g = loadedState({ menu: "start", runStarted: false });
    const { container } = renderWith(g, <Screens />, locale);
    const labels = menuBtns(container).map((b) => b.textContent);
    expect(labels).toHaveLength(4);
    for (const loc of LOCALE_ORDER) expect(labels).not.toContain(translate(loc, "btn.continue"));
  });

  it("opens the rules and the board from the menu", () => {
    const g = loadedState({ menu: "start", runStarted: true });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const btns = menuBtns(container);
    const at = (label: string) => btns.filter((b) => b.textContent === label)[0];
    fireEvent.click(at(translate(locale, "btn.rules")));
    expect(dispatch).toHaveBeenCalledWith({ type: "openModal", modal: "rules" });
    fireEvent.click(at(translate(locale, "btn.scores")));
    expect(dispatch).toHaveBeenCalledWith({ type: "openModal", modal: "scores" });
  });

  it("opens the challenges list from the menu", () => {
    const g = loadedState({ menu: "start", runStarted: true });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const btn = menuBtns(container).filter(
      (b) => b.textContent === translate(locale, "btn.challenges"),
    );
    expect(btn).toHaveLength(1);
    fireEvent.click(btn[0]);
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "challenges" });
  });

  /* New Game confirms exactly when Continue is on offer: with nothing to lose
     a dialog is a click in the way, and with a run behind the menu it is the
     only thing between the player and losing it. */
  it.each([
    [false, { type: "newRun" }, { type: "openModal", modal: "restart" }],
    [true, { type: "openModal", modal: "restart" }, { type: "newRun" }],
  ] as const)("dispatches from New Game with runStarted %s", (runStarted, sent, notSent) => {
    const g = loadedState({ menu: "start", runStarted });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const btn = menuBtns(container).filter(
      (b) => b.textContent === translate(locale, "btn.newGame"),
    );
    expect(btn).toHaveLength(1);
    fireEvent.click(btn[0]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(sent);
    expect(dispatch).not.toHaveBeenCalledWith(notSent);
  });

  /* Cancelling the confirmation returns to the menu, not to the run, so the
     ghost button says Cancel: "Continue" would be a promise it cannot keep. */
  it("cancels the restart confirmation rather than continuing a run", () => {
    const g = loadedState({ menu: "start", modal: "restart" });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const btns = [...container.querySelectorAll<HTMLElement>("button")];
    const labels = btns.map((b) => b.textContent);
    expect(labels).toContain(translate(locale, "btn.cancel"));
    expect(labels).not.toContain(translate(locale, "btn.continue"));
    fireEvent.click(btns[labels.indexOf(translate(locale, "btn.yesRestart"))]);
    expect(dispatch).toHaveBeenCalledWith({ type: "newRun" });
  });

  it("lists no challenge yet and goes back to the menu", () => {
    const { container, dispatch } = renderWith(
      loadedState({ menu: "challenges" }),
      <Screens />,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(translate(locale, "challenges.title"));
    expect(text).toContain(translate(locale, "challenges.empty"));
    expect(container.querySelectorAll("li")).toHaveLength(0);
    const btns = [...container.querySelectorAll<HTMLElement>("button")];
    expect(btns).toHaveLength(1);
    expect(btns[0].textContent).toBe(translate(locale, "btn.back"));
    fireEvent.click(btns[0]);
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });

  /* Mid-trick is the case that used to start a run on the spot behind a
     confirmation; now every state routes through the menu, and Continue there
     is what returns to the deal. */
  it("raises the menu from the rail instead of starting a run", () => {
    const g = loadedState({ phase: "play", trickNo: 3 });
    const { container, dispatch } = renderWith(g, <Rail />, locale);
    const btn = [...container.querySelectorAll<HTMLElement>(".railbtns button")].filter(
      (b) => b.textContent === translate(locale, "btn.newGame"),
    );
    expect(btn).toHaveLength(1);
    fireEvent.click(btn[0]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
    expect(dispatch).not.toHaveBeenCalledWith({ type: "newRun" });
  });

  /* A run total reaches five figures, and Finnish groups thousands with a
     space where English uses a comma. Printing the raw number reads as a
     different score at a glance. */
  it("groups the board's points per language", () => {
    expect(BOARD.every((r) => r.runScore >= 1000)).toBe(true);
    const { container } = renderWith(loadedState(), <Scoreboard rows={BOARD} />, locale);
    const pts = [...container.querySelectorAll(".scorerow .spts")].map((e) => e.textContent);
    expect(pts).toEqual(BOARD.map((r) => formatNumber(locale, r.runScore)));
    if (locale === "fi") expect(pts[0]).not.toBe(String(BOARD[0].runScore));
  });

  /* A board row counts against the same ladder the rail does. The row is the
     one place the denominator is written next to a stored number, so an 8 left
     here would relabel every past run. */
  it("prints a board row's ante over the length of the ladder", () => {
    const rows = [{ ...BOARD[0], ante: 7 }];
    const { container } = renderWith(loadedState(), <Scoreboard rows={rows} />, locale);
    expect(container.querySelector(".scorerow .sante")?.textContent).toBe(`7/${ANTES.length}`);
  });

  /* Asserted on the text, not on the "won" class: the class is styling and
     would still be right with the two labels swapped. */
  it("labels a won run and a lost one on the board", () => {
    const rows = [BOARD[0], BOARD[1]];
    expect(rows.map((r) => r.won)).toEqual([true, false]);
    const { container } = renderWith(loadedState(), <Scoreboard rows={rows} />, locale);
    const res = [...container.querySelectorAll(".scorerow .sres")].map((e) => e.textContent);
    expect(res).toEqual([translate(locale, "score.won"), translate(locale, "score.lost")]);
  });
});

const STORED: ScoreRow[] = [
  { seed: "OLD1", ante: 8, blindIdx: 2, runScore: 50000, won: true, at: 1 },
  { seed: "OLD2", ante: 5, blindIdx: 1, runScore: 20000, won: false, at: 2 },
  { seed: "OLD3", ante: 2, blindIdx: 0, runScore: 900, won: false, at: 3 },
];

/* jsdom provides no Storage, so anything that reads the board installs one. */
function stubStorageWithBoard() {
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
}

const seedsOn = (root: Element) =>
  [...root.querySelectorAll(".scorerow .sseed")].map((e) => e.textContent);

const scoreButtonsIn = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>("button")].filter(
    (b) => b.textContent === translate("fi", "btn.scores"),
  );

/* The board on the end screens is read from the store at render time and the
   run that just ended is merged in, because the provider's effect has not run
   yet on the commit that first shows the screen. */
describe("the end screens show the run that just ended", () => {
  beforeEach(stubStorageWithBoard);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  /* The won run, on nothing but the stored rows. The test above pre-writes the
     row, so it passes with the merge deleted; a won run missing from its own
     board is exactly the bug that would leave. */
  it("draws a won run that nothing has written yet", () => {
    const g = loadedState({ screen: { kind: "victory" } });
    expect(seedsOn(document.body)).toHaveLength(0);
    const { container } = renderWith(g, <Screens />);
    expect(seedsOn(container)).toHaveLength(4);
    expect(seedsOn(container)).toContain(g.seed);
  });
});

/* The board the rail opens is the stored one and nothing else: the run in
   progress has no result yet. */
describe("the scoreboard modal", () => {
  beforeEach(stubStorageWithBoard);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the finished runs and not the one in progress", () => {
    const g = loadedState({ modal: "scores" });
    const { container } = renderWith(g, <Screens />);
    expect(seedsOn(container)).toHaveLength(STORED.length);
    expect(seedsOn(container)).not.toContain(g.seed);
  });

  /* Driven through the real reducer from a state the player can actually be
     in. A hand-written { screen: "shop", modal: "scores" } pair would prove the
     routing of a state nothing can reach: .overlay covers the rail, so the
     shop's own Scores button is the only way in from here. */
  it("draws over the view underneath and gives it back on close", () => {
    const shop = loadedState({ screen: { kind: "shop" }, shop: SHOP });
    const under = renderWith(shop, <Screens />);
    expect(under.container.querySelector(".shelf")).not.toBeNull();
    const open = scoreButtonsIn(under.container);
    expect(open).toHaveLength(1);
    fireEvent.click(open[0]);
    under.unmount();

    const overShop = gameReducer(shop, under.dispatch.mock.calls[0][0]);
    expect(overShop.screen).toEqual(shop.screen);
    const board = renderWith(overShop, <Screens />);
    expect(board.container.querySelector(".scoreboard")).not.toBeNull();
    expect(board.container.querySelector(".shelf")).toBeNull();
    const back = [...board.container.querySelectorAll<HTMLElement>("button")];
    expect(back).toHaveLength(1);
    fireEvent.click(back[0]);
    board.unmount();

    const closed = renderWith(gameReducer(overShop, board.dispatch.mock.calls[0][0]), <Screens />);
    expect(closed.container.querySelector(".shelf")).not.toBeNull();
    expect(closed.container.querySelector(".scoreboard")).toBeNull();
  });

  it("closes back with one action and nothing else", () => {
    const { container, dispatch } = renderWith(loadedState({ modal: "scores" }), <Screens />);
    const back = [...container.querySelectorAll<HTMLElement>("button")];
    expect(back).toHaveLength(1);
    fireEvent.click(back[0]);
    expect(dispatch.mock.calls.map(([a]) => a)).toEqual([{ type: "closeModal" }]);
  });
});

/* The three view fields are drawn modal -> menu -> screen, and the order is
   the whole reason they are three fields: a modal opened over the menu has to
   close back to the menu, and the menu has to cover the screen a resumed run
   carries rather than replace it. */
describe("Screens draws the modal over the menu over the screen", () => {
  it("puts a modal opened from the menu over the menu", () => {
    const { container } = renderWith(loadedState({ menu: "start", modal: "rules" }), <Screens />);
    expect(container.querySelector(".rules")).not.toBeNull();
    expect(container.querySelector(".menubtns")).toBeNull();
  });

  it("puts the menu over the screen the resumed run is sitting on", () => {
    const g = loadedState({ menu: "start", screen: { kind: "shop" }, shop: SHOP });
    const { container } = renderWith(g, <Screens />);
    expect(container.querySelector(".menubtns")).not.toBeNull();
    expect(container.querySelector(".shelf")).toBeNull();
  });
});

/* .overlay is fixed at inset:0 and covers the rail, so the rail's own SCORES
   button cannot be clicked while a screen is up — the same limitation that
   gave the blind select and the game-over screen their own Rules buttons.
   "Any time" therefore has to hold from every screen kind too: four carry a
   Scores button, and the two end screens already draw the board.

   SCREENS below is keyed off the Screen union, so a kind with neither is a
   compile error — but the gate that catches it is the compiler, i.e.
   `npm run typecheck` and `npm run build`. Vitest transpiles with esbuild and
   does not type-check, so `npm test` on its own stays green on a missing
   kind. CI runs all three; a developer running only the tests will not see
   it. */
describe("the board is reachable from every screen", () => {
  beforeEach(stubStorageWithBoard);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* The key is the kind, and the payload is Extract<Screen, { kind: K }>, so a
     case filed under the wrong key does not compile either. */
  type ScreenCase<K extends Screen["kind"]> = {
    label: string;
    screen: Extract<Screen, { kind: K }>;
    also?: Partial<GameState>;
    how: "button" | "drawn";
  };

  const SCREENS: { [K in Screen["kind"]]: ScreenCase<K> } = {
    blindselect: { label: "the blind select", screen: { kind: "blindselect" }, how: "button" },
    shop: { label: "the shop", screen: { kind: "shop" }, also: { shop: SHOP }, how: "button" },
    dealend: {
      label: "the deal-end screen",
      screen: { kind: "dealend", score: 420 },
      how: "button",
    },
    cashout: {
      label: "the cash-out screen",
      screen: {
        kind: "cashout",
        score: 1200,
        reward: 4,
        bonus: 3,
        interest: 2,
        spare: 1,
        bank: 26,
      },
      how: "button",
    },
    gameover: { label: "the game-over screen", screen: { kind: "gameover" }, how: "drawn" },
    victory: { label: "the victory screen", screen: { kind: "victory" }, how: "drawn" },
  };

  /* Walked by value, never by a hand-written list of kinds — that list is the
     defect this fixture exists to remove. */
  const CASES = Object.values(SCREENS).map((c) => [c.label, c] as const);

  it.each(CASES)("opens the board from %s", (_label, { screen, also, how }) => {
    const { container, dispatch } = renderWith(loadedState({ screen, ...also }), <Screens />);
    if (how === "drawn") {
      expect(container.querySelector(".scoreboard")).not.toBeNull();
      return;
    }
    expect(container.querySelector(".scoreboard")).toBeNull();
    const btns = scoreButtonsIn(container);
    expect(btns).toHaveLength(1);
    fireEvent.click(btns[0]);
    expect(dispatch).toHaveBeenCalledWith({ type: "openModal", modal: "scores" });
  });
});

/* An offer that does not fit is bought by naming what it replaces. The pending
   offer and the selection are component state, so what a test can hold is the
   wiring: what each button reads, what a click dispatches, and that nothing is
   dispatched until the confirm. */
describe.each(LOCALE_ORDER)("the shop's replace picker (%s)", (locale) => {
  /* Every capped storage full at once: three jokers in three slots, two
     tuppipakka cards in two, and loadedState's two tricks in the default two.
     Vouchers are uncapped, so the same shelf covers them too. */
  const pickerState = (over: Partial<GameState> = {}) =>
    loadedState({
      screen: { kind: "shop" },
      shop: REPLACE_SHOP,
      money: 20,
      jokerSlots: 3,
      sideSlots: 2,
      ...over,
    });

  function shop(over: Partial<GameState> = {}) {
    const g = pickerState(over);
    const rendered = renderWith(g, <Screens />, locale);
    const buyButton = (index: number) => {
      const btns = rendered.container.querySelectorAll<HTMLButtonElement>(".shelf .buy");
      if (!btns[index]) throw new Error(`no shelf button at ${index}`);
      return btns[index];
    };
    /* Found by its label rather than its position, so the two footer buttons
       cannot be swapped without the test noticing. */
    const pickButton = (key: "btn.doReplace" | "btn.cancel") => {
      const label = translate(locale, key);
      const found = [
        ...rendered.container.querySelectorAll<HTMLButtonElement>(".replacepick .row button"),
      ].filter((b) => b.textContent === label);
      expect(found, `${key} in the picker's footer`).toHaveLength(1);
      return found[0];
    };
    const rows = () => [
      ...rendered.container.querySelectorAll<HTMLElement>(".replacepick .replaceitem"),
    ];
    return { ...rendered, g, buyButton, pickButton, rows };
  }

  /* index, the storage it competes for, and the item at that index. */
  const OFFERS: Array<[string, number, (g: GameState) => Array<{ key: string }>]> = [
    ["a joker", 0, (g) => g.jokers],
    ["a trick", 2, (g) => g.consumables],
  ];

  it.each(OFFERS)("labels %s that does not fit Replace and opens the picker", (_l, index, of) => {
    const { g, container, dispatch, buyButton } = shop();
    const btn = buyButton(index);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe(
      translate(locale, "shop.buyReplace", { price: REPLACE_SHOP[index].price }),
    );
    fireEvent.click(btn);
    expect(dispatch).not.toHaveBeenCalled();
    expect(container.querySelector(".replacepick")).not.toBeNull();
    expect(container.querySelector(".shelf")).toBeNull();
    expect(container.querySelectorAll(".replacepick .replaceitem")).toHaveLength(of(g).length);
  });

  it.each(OFFERS)("lists %s storage's own items with their descriptions", (_l, index, of) => {
    const { g, dispatch, buyButton, rows } = shop();
    fireEvent.click(buyButton(index));
    const held = of(g);
    expect(rows()).toHaveLength(held.length);
    rows().forEach((row, i) => {
      expect(row.textContent).toContain(nameOfIn(locale, held[i]));
      expect(row.textContent).toContain(descOfIn(locale, held[i]));
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  /* The tuppipakka rows carry the card itself, so the row says which card the
     enhancement upgrades and not only what it does. */
  it("lists the tuppipakka's cards, each with its enhancement", () => {
    const { g, buyButton, rows } = shop();
    fireEvent.click(buyButton(3));
    expect(rows()).toHaveLength(g.sideDeck.length);
    rows().forEach((row, i) => {
      const c = g.sideDeck[i];
      const enh = c.enh;
      if (!enh) throw new Error("the fixture's tuppipakka card carries no enhancement");
      expect(row.querySelector<HTMLElement>(".card")?.dataset.uid).toBe(c.uid);
      expect(row.textContent).toContain(nameOfIn(locale, ENH[enh]));
      expect(row.textContent).toContain(descOfIn(locale, ENH[enh]));
    });
  });

  it("sends one buy carrying the selected index on confirm", () => {
    const { container, dispatch, buyButton, pickButton, rows } = shop();
    fireEvent.click(buyButton(0));
    /* The last joker, not the first: a confirm that hard-coded index 0 would
       pass an assertion made against the first row. */
    const k = rows().length - 1;
    fireEvent.click(rows()[k]);
    expect(rows()[k].classList.contains("selected")).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(pickButton("btn.doReplace"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toStrictEqual({ type: "buy", index: 0, replace: k });
    expect(container.querySelector(".replacepick")).toBeNull();
  });

  it("dispatches nothing when the pick is cancelled", () => {
    const { container, dispatch, buyButton, pickButton, rows } = shop();
    fireEvent.click(buyButton(0));
    fireEvent.click(rows()[1]);
    fireEvent.click(pickButton("btn.cancel"));
    expect(dispatch).not.toHaveBeenCalled();
    expect(container.querySelector(".replacepick")).toBeNull();
    expect(container.querySelector(".shelf")).not.toBeNull();
  });

  /* Clicked rather than only read: a button that is disabled only by class
     would still fire its onClick. */
  it("will not confirm with nothing selected", () => {
    const { dispatch, buyButton, pickButton } = shop();
    fireEvent.click(buyButton(0));
    const confirm = pickButton("btn.doReplace");
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("opens nothing from an offer that cannot be afforded", () => {
    const { container, dispatch, buyButton } = shop({ money: 0 });
    const btn = buyButton(0);
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(dispatch).not.toHaveBeenCalled();
    expect(container.querySelector(".replacepick")).toBeNull();
  });

  /* Vouchers are uncapped, so a full run of everything else still buys one
     outright — no picker, and no replace field on the action. */
  it("buys a voucher outright with every other storage full", () => {
    const { container, dispatch, buyButton } = shop();
    const btn = buyButton(1);
    expect(btn.textContent).toBe(translate(locale, "shop.buy", { price: REPLACE_SHOP[1].price }));
    fireEvent.click(btn);
    expect(dispatch.mock.calls[0][0]).toStrictEqual({ type: "buy", index: 1 });
    expect(container.querySelector(".replacepick")).toBeNull();
  });

  /* The shop's footer stays live while the picker is open, so a reroll can put
     a different kind of offer at the pending shelf index. The selection is an
     index into whichever inventory that offer competes for, so it has to go
     with the offer: a joker pick surviving into a card offer would confirm a
     purchase that discards a tuppipakka card the player never chose. */
  it("drops the selection when a reroll changes the offer at that index", () => {
    const before = pickerState();
    /* The card offer moved to index 0, where the joker offer was. */
    const after = pickerState({ shop: [REPLACE_SHOP[3], ...REPLACE_SHOP.slice(1)] });
    const { container, dispatch } = renderWith(
      before,
      <Restocked before={before} after={after} />,
      locale,
    );
    const rows = () => [...container.querySelectorAll<HTMLElement>(".replacepick .replaceitem")];
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>(".shelf .buy")[0]);
    expect(rows()).toHaveLength(before.jokers.length);
    fireEvent.click(rows()[1]);
    expect(rows()[1].classList.contains("selected")).toBe(true);

    fireEvent.click(container.querySelector<HTMLElement>(".restock")!);
    expect(rows()).toHaveLength(after.sideDeck.length);
    expect(rows().map((r) => r.classList.contains("selected"))).toEqual(
      after.sideDeck.map(() => false),
    );
    const confirm = [
      ...container.querySelectorAll<HTMLButtonElement>(".replacepick .row button"),
    ].filter((b) => b.textContent === translate(locale, "btn.doReplace"));
    expect(confirm[0].disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

/* The tuppipakka swap is select-then-confirm: a click on a side-deck card
   opens an infobox about it, and only the confirm button spends the swap. The
   selection lives in the panel, so what a test can hold is the wiring — what a
   click dispatches, what the infobox names, and that an unavailable card is
   readable but not confirmable. */
describe.each(LOCALE_ORDER)("the tuppipakka swap panel (%s)", (locale) => {
  function swapPanel(tweak: (g: GameState) => Partial<GameState> = () => ({})) {
    const base = loadedState({ phase: "swap" });
    const g = { ...base, ...tweak(base) };
    const rendered = renderWith(g, [<Table key="t" />, <Hand key="h" />], locale);
    /* Every side card carries its uid, so a test can name one; throwing here
       is what proves the attribute is there. */
    const sideCard = (uid: string) => {
      const el = rendered.container.querySelector<HTMLElement>(`.sidecard[data-uid="${uid}"]`);
      if (!el) throw new Error(`no .sidecard with data-uid ${uid}`);
      return el;
    };
    return { ...rendered, g, sideCard };
  }

  /* Found by its label, not by its index: the footer swaps one button for two
     while a card is selected. */
  function footerButton(root: Element, key: "btn.doSwap" | "btn.cancel" | "btn.toDeclaration") {
    const label = translate(locale, key);
    const found = [...root.querySelectorAll<HTMLButtonElement>("#declpanel .row button")].filter(
      (b) => b.textContent === label,
    );
    expect(found, `${key} in the footer`).toHaveLength(1);
    return found[0];
  }

  it("selects a side-deck card instead of swapping it", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(g.sideDeck[0].uid));
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain("pickSideCard");
    expect(container.querySelector("#declpanel .swapinfo")).not.toBeNull();
  });

  it("names and describes the selected card's own enhancement", () => {
    const { g, container, sideCard } = swapPanel();
    const enh = g.sideDeck[0].enh;
    if (!enh) throw new Error("the fixture's first side-deck card carries no enhancement");
    fireEvent.click(sideCard(g.sideDeck[0].uid));
    const text = container.querySelector(".swapinfo")?.textContent ?? "";
    expect(text).toContain(nameOfIn(locale, ENH[enh]));
    expect(text).toContain(descOfIn(locale, ENH[enh]));
  });

  /* Pinned to the twin's uid rather than to "a hand card": the swap replaces
     one card and nothing else, and the fixture's first hand card is not it. */
  it("shows both cards of the exchange, the twin included", () => {
    const { g, container, sideCard } = swapPanel();
    const sel = g.sideDeck[0];
    fireEvent.click(sideCard(sel.uid));
    const cards = [...container.querySelectorAll<HTMLElement>(".swapinfo .card")];
    expect(cards.map((c) => c.dataset.uid)).toEqual([sel.uid, swapTargets(g, sel)[0].uid]);
  });

  it("sends one pickSideCard for the selected card on confirm", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(g.sideDeck[0].uid));
    fireEvent.click(footerButton(container, "btn.doSwap"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "pickSideCard", uid: g.sideDeck[0].uid });
    expect(container.querySelector(".swapinfo")).toBeNull();
  });

  it("dispatches nothing when the selection is cancelled", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(g.sideDeck[0].uid));
    fireEvent.click(footerButton(container, "btn.cancel"));
    expect(container.querySelector(".swapinfo")).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    /* The way out of the phase is back in the footer. */
    expect(footerButton(container, "btn.toDeclaration")).toBeTruthy();
  });

  it("cancels the selection when the selected card is clicked again", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(g.sideDeck[0].uid));
    fireEvent.click(sideCard(g.sideDeck[0].uid));
    expect(container.querySelector(".swapinfo")).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("moves the selection to a second card rather than swapping the first", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(g.sideDeck[0].uid));
    fireEvent.click(sideCard(g.sideDeck[1].uid));
    const cards = [...container.querySelectorAll<HTMLElement>(".swapinfo .card")];
    expect(cards.map((c) => c.dataset.uid)).toEqual([g.sideDeck[1].uid]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  /* Every reason a card cannot be taken, in the reducer's own guard order.
     The confirm button is clicked rather than only read: disabled that is only
     a class would still fire an onClick. */
  const UNAVAILABLE: Array<
    [
      string,
      number,
      (g: GameState) => Partial<GameState>,
      "swap.unavailUsed" | "swap.unavailNoSwaps" | "swap.unavailNoMatch",
    ]
  > = [
    ["its twin went to another seat", 1, () => ({}), "swap.unavailNoMatch"],
    [
      "it has already been swapped in",
      0,
      (g) => ({ usedSide: [g.sideDeck[0].uid], swapsLeft: g.swapsLeft - 1 }),
      "swap.unavailUsed",
    ],
    /* sideDeck[0] matches a card in hand, so only the spent swaps stop it. */
    ["the swaps are spent", 0, () => ({ swapsLeft: 0 }), "swap.unavailNoSwaps"],
    /* Both apply at once; the reducer answers "already swapped in" first. */
    [
      "it is both spent and swapped in",
      0,
      (g) => ({ usedSide: [g.sideDeck[0].uid], swapsLeft: 0 }),
      "swap.unavailUsed",
    ],
  ];

  it.each(UNAVAILABLE)("explains but will not swap a card whose %s", (_why, index, tweak, key) => {
    const { g, container, dispatch, sideCard } = swapPanel(tweak);
    const sel = g.sideDeck[index];
    fireEvent.click(sideCard(sel.uid));
    expect(container.querySelector(".swapinfo")).not.toBeNull();
    expect(container.querySelector(".swapwhy")?.textContent).toBe(
      translate(locale, key, { card: cardName(sel) }),
    );
    const confirm = footerButton(container, "btn.doSwap");
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(dispatch).not.toHaveBeenCalled();
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

/* Below 560px the rail is five pages in a horizontal scroll-snap scroller.
   jsdom lays out nothing, so what it can hold is the structure and the wiring:
   which plate is on which page, that the arrows are two and wordless, that an
   arrow scrolls the next page into view, that they disable at the ends of the
   strip and that nothing else turns the page. The geometry — the snap positions, the felt's
   300px floor, the two support columns — is measured in Chrome emulation. */
describe("the rail's phone pages", () => {
  const arrows = (root: Element) => [
    ...root.querySelectorAll<HTMLButtonElement>(".railnav button"),
  ];
  const prev = (root: Element) => arrows(root)[0];
  const next = (root: Element) => arrows(root)[1];
  /* The index the arrows sit on, read back from what they will do next: the
     first page disables prev, the last disables next. */
  const at = (root: Element, i: number) => {
    expect(prev(root).disabled).toBe(i === 0);
    expect(next(root).disabled).toBe(i === 4);
  };

  /* A rail rendered by a wrapper of its own, so a re-render with a new state
     reconciles the same Rail rather than remounting it and resetting its page. */
  function Wrap({ state }: { state: GameState }) {
    return (
      <LocaleProvider initial="fi">
        <GameDispatchContext.Provider value={vi.fn()}>
          <GameStateContext.Provider value={state}>
            <Rail />
          </GameStateContext.Provider>
        </GameDispatchContext.Provider>
      </LocaleProvider>
    );
  }

  /* jsdom reports 0 for every layout property, which is the one input the
     scroll handler refuses. Both have to be planted to fake a scrolled strip. */
  function scrollStrip(root: Element, scrollLeft: number, clientWidth: number) {
    const strip = root.querySelector(".railstrip");
    if (!strip) throw new Error("no .railstrip");
    Object.defineProperty(strip, "clientWidth", { value: clientWidth, configurable: true });
    Object.defineProperty(strip, "scrollLeft", { value: scrollLeft, configurable: true });
    fireEvent.scroll(strip);
  }

  function stubScrollIntoView() {
    const stub = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: stub,
      configurable: true,
      writable: true,
    });
    return stub;
  }

  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("puts every plate on its own page, in the documented order", () => {
    const { container } = renderWith(loadedState(), <Rail />);
    const pages = [...container.querySelectorAll(".railpage")];
    expect(pages).toHaveLength(5);
    expect(pages.map((p) => p.className)).toEqual([
      "railpage rp-game",
      "railpage rp-blind",
      "railpage rp-deal",
      "railpage rp-kit",
      "railpage rp-support",
    ]);

    const on = (page: string, sel: string) =>
      container.querySelector(`.${page} ${sel}`) !== null &&
      container.querySelectorAll(sel).length ===
        container.querySelectorAll(`.${page} ${sel}`).length;

    expect(on("rp-game", ".railtop")).toBe(true);
    expect(on("rp-game", ".seedchip")).toBe(true);
    expect(on("rp-game", ".langbtn")).toBe(true);
    expect(on("rp-game", ".railbtns")).toBe(true);
    expect(on("rp-blind", ".blindplate")).toBe(true);
    expect(on("rp-blind", ".slate")).toBe(true);
    expect(on("rp-deal", ".tallies")).toBe(true);
    expect(on("rp-deal", ".stats")).toBe(true);
    expect(on("rp-kit", ".jokers")).toBe(true);
    expect(on("rp-kit", ".sidelist")).toBe(true);
    expect(on("rp-kit", ".cons")).toBe(true);
    expect(on("rp-support", ".support")).toBe(true);
    /* The support page keeps all thirteen rows and their PARTIES order: the
       two columns are CSS, not a second list. */
    expect([...container.querySelectorAll(".rp-support .supportrow .pbadge")]).toHaveLength(13);

    /* .brand is on no page — the ante shows on all five. */
    expect(container.querySelector(".rail > .brand")).not.toBeNull();
    expect(container.querySelector(".railpage .brand")).toBeNull();
    /* And the footer is still three buttons, wrapper or no wrapper. */
    expect(container.querySelectorAll(".railbtns button")).toHaveLength(3);
  });

  /* The glyph is drawn by the stylesheet, so the button's own text is empty
     and the label is the only thing a screen reader has to go on. */
  it("draws two arrows, wordless but labelled, in both languages", () => {
    for (const locale of LOCALE_ORDER) {
      const { container } = renderWith(loadedState(), <Rail />, locale);
      const a = arrows(container);
      expect(a).toHaveLength(2);
      for (const b of a) {
        expect(b.textContent).toBe("");
        expect(b.getAttribute("title")).toBeNull();
        expect(b.getAttribute("type")).toBe("button");
      }
      expect(a[0].getAttribute("aria-label")).toBe(translate(locale, "rail.prevPage"));
      expect(a[1].getAttribute("aria-label")).toBe(translate(locale, "rail.nextPage"));
    }
  });

  it("scrolls the next page into view, and no ancestor with it", () => {
    const stub = stubScrollIntoView();
    const { container } = renderWith(loadedState(), <Rail />);
    fireEvent.click(next(container));
    expect(stub).toHaveBeenCalledTimes(1);
    /* Exact args: without block the browser may scroll the felt away. */
    expect(stub).toHaveBeenCalledWith({ block: "nearest", inline: "start" });
    expect(stub.mock.contexts[0]).toBe(container.querySelector(".rp-deal"));
  });

  /* The arrows walk the swipe's order, so a mapping that quietly went back to
     DOM order would send the second page to the seed chip. */
  it("walks the pages in the order they sit on the strip", () => {
    const stub = stubScrollIntoView();
    const { container } = renderWith(loadedState(), <Rail />);
    const swiped = [".rp-deal", ".rp-kit", ".rp-support", ".rp-game"];
    for (let i = 0; i < swiped.length; i++) fireEvent.click(next(container));
    expect(stub.mock.contexts).toEqual(swiped.map((sel) => container.querySelector(sel)));

    /* And back, without the first page's own scroll: prev from .rp-blind is
       disabled, so the walk is one shorter. */
    stub.mockClear();
    const back = [".rp-support", ".rp-kit", ".rp-deal", ".rp-blind"];
    for (let i = 0; i < back.length; i++) fireEvent.click(prev(container));
    expect(stub.mock.contexts).toEqual(back.map((sel) => container.querySelector(sel)));
  });

  it("survives a click where the browser has no scrollIntoView", () => {
    expect(Element.prototype.scrollIntoView).toBeUndefined();
    const { container } = renderWith(loadedState(), <Rail />);
    /* React catches what a handler throws and re-reports it to the page, so a
       plain not.toThrow() here passes however the call is written. The window
       is where the throw actually lands. */
    const thrown: unknown[] = [];
    const onError = (e: ErrorEvent) => {
      thrown.push(e.error);
      e.preventDefault();
    };
    window.addEventListener("error", onError);
    fireEvent.click(next(container));
    window.removeEventListener("error", onError);
    expect(thrown).toEqual([]);
  });

  it("follows the page the strip has scrolled to", () => {
    const { container } = renderWith(loadedState(), <Rail />);
    /* The rail opens on the blind, so there is nowhere to go back to. */
    at(container, 0);

    scrollStrip(container, 3 * 300, 300);
    at(container, 3);
  });

  it("clamps to the last page", () => {
    const { container } = renderWith(loadedState(), <Rail />);
    scrollStrip(container, 900, 100);
    at(container, 4);
  });

  it("holds its page when the strip reports no width", () => {
    const { container } = renderWith(loadedState(), <Rail />);
    scrollStrip(container, 2 * 300, 300);
    /* An unguarded divide by zero here is NaN, and NaN clamps to neither end,
       so both arrows would come back enabled on the last page. */
    scrollStrip(container, 120, 0);
    at(container, 2);
  });

  it("never turns the page by itself", () => {
    const stub = stubScrollIntoView();
    const g = loadedState({ phase: "declare" });
    const { container, rerender } = render(<Wrap state={g} />);
    scrollStrip(container, 2 * 300, 300);
    at(container, 2);

    for (const over of [{ phase: "play" as const }, { phase: "shop" as const }, { blindIdx: 2 }]) {
      rerender(<Wrap state={{ ...g, ...over }} />);
      at(container, 2);
    }
    expect(stub).not.toHaveBeenCalled();
  });
});
