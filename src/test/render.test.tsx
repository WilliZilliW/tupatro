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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { econOf } from "../game/economy";
import { fireEvent, render } from "@testing-library/react";
import { Hand } from "../components/hand/Hand";
import { Hint } from "../components/hand/Hint";
import { Panels } from "../components/panels/Panels";
import { Rail } from "../components/rail/Rail";
import { Scoreboard } from "../components/screens/Scoreboard";
import { Screens } from "../components/screens/Screens";
import { Table } from "../components/table/Table";
import { Seats } from "../components/table/Seats";
import { Toasts } from "../components/Toasts";
import { App } from "../App";
import { BOSSES, CHALLENGES, JOKERS, CONSUMABLES, VOUCHERS, PARTIES, ENH } from "../game/content";
import {
  ANTES,
  NAMI_TARGET,
  POLITIIKKA_TARGET,
  RACE_TARGET,
  RPS_ROUNDS,
  SEATS,
  TUPPI_TARGET,
} from "../game/constants";
import { cardName, partyOf, rv } from "../game/cards";
import { governmentFor, termOf } from "../game/puolue";
import { swapTargets } from "../game/rules";
import { PlayingCard } from "../components/PlayingCard";
import {
  LOCALE_NAMES,
  LOCALE_ORDER,
  descOfIn,
  emblemOfIn,
  formatNumber,
  nameOfIn,
  translate,
  translateList,
  type LocaleKey,
} from "../i18n";
import { fi } from "../i18n/fi";
import { GameDispatchContext, GameStateContext } from "../hooks/gameContexts";
import { useGameState } from "../hooks/useGame";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { loadedState, renderWith, stubNet } from "./harness";
import { NetContext, OFF_CHAIRS, type Net, type NetChair } from "../hooks/netContext";
import { SCOPE } from "../net/protocol";
import { packSdp } from "../net/signal";
import { qrMatrix } from "../net/qr";
import { ANSWER_SDP, OFFER_SDP } from "../net/sdp.fixture";
import { card, withEcon, withOver, type StateOver } from "./factories";
import { gameReducer } from "../game/reducer";
import { dehydrate } from "../game/save";
import { createRun } from "../game/state";
import { addScore, rowFor } from "../game/scores";
import {
  writeChallengeRun,
  writeChallengeScores,
  writeRaceScores,
  writeRun,
  writeScores,
} from "../game/storage";
import type { ScoreRow } from "../game/scores";
import type {
  Card,
  GameState,
  MatchId,
  MenuView,
  Modal,
  Phase,
  Screen,
  Seat,
  ShopItem,
} from "../game/types";
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
  /* A caller that forgets a placeholder, or spells it differently from the
     catalogue, renders the braces as text — the type cannot see it, and the
     i18n test only compares the two catalogues with each other. */
  expect(text, `${label} [${locale}] printed an unfilled placeholder`).not.toMatch(/\{\w+\}/);
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
  const uid = econOf(useGameState(), 0).sideDeck[index].uid;
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

/* A challenge run parked mid-laydown: a table with one run on it, a hand that
   can extend it, and none of the roguelike shell — the state every challenge
   fixture below starts from. hands[0] is empty for the whole laydown, which is
   why SPREAD_PHASES is deliberately left alone. */
const laydownState = (over: Partial<GameState> = {}): GameState =>
  loadedState({
    challenge: "rummikub",
    phase: "laydown",
    screen: null,
    mode: "rami",
    ramSeat: null,
    ramTeam: null,
    hands: [[], [], [], []],
    jokers: [],
    consumables: [],
    vouchers: [],
    sideDeck: [],
    boss: null,
    money: 0,
    target: 0,
    deals: 4,
    blindDeals: 4,
    dealsLeft: 3,
    blindScore: 42,
    tricks: [7, 6],
    table: [[card("H", 3), card("H", 4), card("H", 5)]],
    layHands: [
      [card("S", 14), card("S", 9), card("H", 9), card("C", 9)],
      [card("D", 2), card("D", 3)],
    ],
    layTurn: 0,
    layNo: 2,
    layPassed: 0,
    layScores: [27, 12],
    ...over,
  });

/* A race in progress: ordinary tuppi with none of the shell, a deal number,
   two running totals and a match target. Deliberately mid-match rather than
   at deal one, so every number the plate and the screens draw is non-zero. */
const raceState = (over: Partial<GameState> = {}): GameState =>
  loadedState({
    challenge: "race",
    phase: "play",
    screen: null,
    jokers: [],
    consumables: [],
    vouchers: [],
    sideDeck: [],
    boss: null,
    money: 0,
    target: RACE_TARGET,
    deals: 0,
    blindDeals: 0,
    dealsLeft: 0,
    blindScore: 0,
    raceDeal: 5,
    raceBase: [1400, 600],
    raceScores: [8200, 4100],
    tricks: [7, 6],
    mode: "rami",
    ramSeat: 0,
    ramTeam: 0,
    ...over,
  });

/* Every phase draws. A new phase that nobody handles shows up here rather
   than in the browser — and the shared table's own sweep walks the same list,
   so a phase is swept from a chair and from the wall by one edit.

   Keyed off the Phase union rather than hand-listed, the way the screen,
   modal and menu sweeps are: a thirteenth phase fails to type-check here
   until it is named, instead of compiling clean and being swept by nothing.
   The value says whether the phase draws a decision panel, which is the one
   thing the shared table's sweep needs to know about a phase beyond its
   name. */
const PHASE_PANEL: Record<Phase, boolean> = {
  blindselect: false,
  swap: true,
  declare: true,
  soolioffer: true,
  sooligive: true,
  sooliready: true,
  play: false,
  resolve: false,
  trickend: false,
  laydown: true,
  handend: false,
  shop: false,
  rpsthrow: true,
  rpsreveal: false,
};

const PHASES = Object.keys(PHASE_PANEL) as Phase[];

/* A traditional match in progress: the same deal a race is, on tuppi's own
   point table. raceBase stays [0, 0] — its tricks are worth no chips at all —
   and the totals are two-figure rather than five. */
const tradState = (over: Partial<GameState> = {}): GameState =>
  raceState({
    challenge: "tuppi",
    target: TUPPI_TARGET,
    raceBase: [0, 0],
    raceScores: [28, 0],
    ...over,
  });

/* Tupatro: the same deal as tradState, with a full temppu box for the viewing
   seat — so its own rail page draws the box a Traditional Tuppi rail never
   does. */
const tupatroState = (over: Partial<GameState> = {}): GameState =>
  withEcon(tradState({ challenge: "tupatro", ...over }), 0, {
    consumables: [CONSUMABLES[0], CONSUMABLES[1]],
  });

/* Nami in progress: the race's own shape, no declaration at all (ramSeat and
   ramTeam stay null, unlike the race's and the traditional match's), and a
   running total that can be negative on either side. raceBase holds the
   in-progress deal's own already-signed value — there is no further
   arithmetic applied to it, unlike the race's chips × mult. */
const namiState = (over: Partial<GameState> = {}): GameState =>
  raceState({
    challenge: "nami",
    target: NAMI_TARGET,
    ramSeat: null,
    ramTeam: null,
    raceBase: [7, -3],
    raceScores: [24, -8],
    ...over,
  });

/* Politiikka: the race's own shape, no declaration at all (ramSeat and
   ramTeam stay null, like Nami's), a real "rami"/"nolo" mode set by the
   rotation rather than a declaration, and raceBase already holding the
   deal's own signed party-capture value — no scoreTrick, so no further
   arithmetic to apply, exactly like Nami's own raceBase. raceDeal is fixed at
   5 (term 2 of the seed's own government sequence) so a test can compute the
   same government with governmentFor("RENDERTEST", 2) and know it will not
   change underfoot. A ♥Q sits in the viewing seat's hand so the Sofia marker
   sweeps alongside the government-emblem highlight. */
const politicsState = (over: Partial<GameState> = {}): GameState =>
  raceState({
    challenge: "politiikka",
    target: POLITIIKKA_TARGET,
    ramSeat: null,
    ramTeam: null,
    raceDeal: 5,
    raceBase: [3, 0],
    raceScores: [11, -6],
    mode: "rami",
    ...over,
  });

/* Rock-Paper-Scissors: a hand of one card per suit, so every leg of the
   suit-to-throw legend is on screen at once and one of them is an honour —
   mode/ramSeat/ramTeam stay null, exactly as startDeal's own RPS arm leaves
   them. One round in, one round already won, so both the round number and the
   score are non-zero. */
const rpsState = (over: Partial<GameState> = {}): GameState =>
  loadedState({
    challenge: "rps",
    phase: "rpsthrow",
    screen: null,
    jokers: [],
    consumables: [],
    vouchers: [],
    sideDeck: [],
    boss: null,
    money: 0,
    target: RPS_ROUNDS,
    deals: 0,
    blindDeals: 0,
    dealsLeft: 0,
    blindScore: 0,
    tricks: [0, 0],
    mode: null,
    ramSeat: null,
    ramTeam: null,
    hands: [
      [card("H", 9), card("S", 4), card("D", 11), card("C", 13)],
      [card("H", 2), card("S", 7), card("D", 3), card("C", 8)],
      [],
      [],
    ] as GameState["hands"],
    rpsRound: 1,
    rpsWins: [1, 0],
    /* Own card is null — the hand below the felt is the decision — and the
       opponent's is already drawn but not yet shown on the felt (see
       RpsTable's own comment): the fixture holds both truths at once, exactly
       as the reducer does mid-round. */
    rpsCards: [null, card("H", 5)],
    ...over,
  });

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
  [
    "the single-player screen with a run to return to",
    () => loadedState({ menu: "single", runStarted: true }),
    () => <Screens />,
  ],
  [
    "the single-player screen with no run yet",
    () => loadedState({ menu: "single", runStarted: false }),
    () => <Screens />,
  ],
  ["the lobby", () => loadedState({ menu: "lobby" }), () => <Screens />],
  ["the rules panel", () => loadedState({ modal: "rules" }), () => <Screens />],
  ["the seed dialog", () => loadedState({ modal: "seed" }), () => <Screens />],
  ["the restart confirmation", () => loadedState({ modal: "restart" }), () => <Screens />],
  ["the scores modal", () => loadedState({ modal: "scores" }), () => <Screens />],
  ["the hang-up confirmation", () => loadedState({ modal: "hangup" }), () => <Screens />],
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
    "the declaration panel under Pakkonolo",
    () =>
      loadedState({
        phase: "declare",
        declSeq: [0, 1, 2, 3],
        declIdx: 0,
        boss: { id: "pakkonolo", key: "boss.pakkonolo" },
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
      return withOver(g, {
        usedSide: [econOf(g, 0).sideDeck[0].uid],
        swapsLeft: econOf(g, 0).swapsLeft - 1,
      });
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
  /* Bot defenders can solo in the main run too now (see
     2026-09-16-ai-takes-sooli-when-sensible), which the owner's own pair can
     be on either side of. The whole app is drawn, not just one panel: the
     rail's need line (Slate), the mode box's "who is soloing" note and the
     hand all have their own reading of whose sooli this is. */
  [
    "an AI soloist against the owner's rami",
    () =>
      loadedState({
        phase: "play",
        mode: "rami",
        ramSeat: 0,
        ramTeam: 0,
        sooli: true,
        sooliSeat: 1,
        sooliOrder: [0, 2, 1],
        leader: 0,
        turn: 0,
        tricks: [4, 3],
        hands: [
          [card("S", 5), card("H", 6)],
          [card("D", 9)],
          [card("C", 4), card("C", 5)],
          [],
        ] as GameState["hands"],
      }),
    () => <App />,
  ],
  [
    "the owner sitting out as the soloist's own partner",
    () =>
      loadedState({
        phase: "play",
        mode: "rami",
        ramSeat: 1,
        ramTeam: 1,
        sooli: true,
        sooliSeat: 2,
        sooliOrder: [1, 3, 2],
        leader: 1,
        turn: 1,
        tricks: [3, 4],
        hands: [
          [],
          [card("S", 7)],
          [card("D", 11)],
          [card("C", 6), card("C", 8)],
        ] as GameState["hands"],
      }),
    () => <App />,
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
    () => loadedState({ mode: "nolo", ramSeat: null, ramTeam: null, revealTo: 0 }),
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
  ["the laydown panel", () => laydownState(), () => [<Table key="t" />, <Hand key="h" />]],
  [
    "the laydown panel on the opponents' turn",
    () => laydownState({ layTurn: 1 }),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the laydown panel with an empty table",
    () => laydownState({ table: [], layScores: [0, 0], layNo: 0 }),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the challenge deal end",
    () => laydownState({ phase: "handend", screen: { kind: "dealend", score: 26 } }),
    () => <Screens />,
  ],
  [
    "the challenge-over screen",
    () =>
      laydownState({
        phase: "handend",
        dealsLeft: 0,
        runScore: 137,
        blindScore: 137,
        screen: { kind: "challengeover", score: 137 },
      }),
    () => <Screens />,
  ],
  ["the challenge rail", () => laydownState(), () => <Rail />],
  [
    "the menu over a challenge",
    () => laydownState({ menu: "start", runStarted: true }),
    () => <Screens />,
  ],
  ["the race rail", () => raceState(), () => <Rail />],
  [
    "the race sooli offer",
    () => raceState({ phase: "soolioffer", ramSeat: 1, ramTeam: 1, sooliSeat: 0 }),
    () => <Table />,
  ],
  ["the race table and hand", () => raceState(), () => [<Table key="t" />, <Hand key="h" />]],
  [
    "the race deal end",
    () => raceState({ phase: "handend", screen: { kind: "dealend", score: 1400 } }),
    () => <Screens />,
  ],
  [
    "the race-over screen",
    () =>
      raceState({
        phase: "handend",
        raceScores: [RACE_TARGET + 400, 4100],
        runScore: RACE_TARGET + 400,
        screen: {
          kind: "raceover",
          winner: 0,
          scores: [RACE_TARGET + 400, 4100],
          deals: 8,
        },
      }),
    () => <Screens />,
  ],
  [
    "the race-over screen from the losing pair's seat",
    () =>
      raceState({
        phase: "handend",
        raceScores: [4100, RACE_TARGET + 400],
        screen: {
          kind: "raceover",
          winner: 1,
          scores: [4100, RACE_TARGET + 400],
          deals: 11,
        },
      }),
    () => <Screens />,
  ],
  ["the traditional rail", () => tradState(), () => <Rail />],
  [
    "the traditional sooli offer",
    () => tradState({ phase: "soolioffer", ramSeat: 1, ramTeam: 1, sooliSeat: 0 }),
    () => <Table />,
  ],
  [
    "the traditional table and hand",
    () => tradState(),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the traditional deal end",
    () => tradState({ phase: "handend", screen: { kind: "dealend", score: 12 } }),
    () => <Screens />,
  ],
  [
    "the traditional match-over screen",
    () =>
      tradState({
        phase: "handend",
        raceScores: [TUPPI_TARGET + 4, 0],
        runScore: TUPPI_TARGET + 4,
        screen: {
          kind: "raceover",
          winner: 0,
          scores: [TUPPI_TARGET + 4, 0],
          deals: 9,
        },
      }),
    () => <Screens />,
  ],
  [
    "the traditional match-over screen from the losing pair's seat",
    () =>
      tradState({
        phase: "handend",
        raceScores: [0, TUPPI_TARGET + 4],
        screen: {
          kind: "raceover",
          winner: 1,
          scores: [0, TUPPI_TARGET + 4],
          deals: 14,
        },
      }),
    () => <Screens />,
  ],
  ["the tupatro rail", () => tupatroState(), () => <Rail />],
  ["the tupatro table and hand", () => tupatroState(), () => [<Table key="t" />, <Hand key="h" />]],
  [
    "the tupatro deal end",
    () => tupatroState({ phase: "handend", screen: { kind: "dealend", score: 12 } }),
    () => <Screens />,
  ],
  [
    "the tupatro match-over screen",
    () =>
      tupatroState({
        phase: "handend",
        raceScores: [TUPPI_TARGET + 4, 0],
        runScore: TUPPI_TARGET + 4,
        screen: {
          kind: "raceover",
          winner: 0,
          scores: [TUPPI_TARGET + 4, 0],
          deals: 9,
        },
      }),
    () => <Screens />,
  ],
  ["the Nami rail", () => namiState(), () => <Rail />],
  ["the Nami table and hand", () => namiState(), () => [<Table key="t" />, <Hand key="h" />]],
  [
    "the Nami deal end",
    () => namiState({ phase: "handend", screen: { kind: "dealend", score: 7 } }),
    () => <Screens />,
  ],
  [
    "the Nami match-over screen",
    () =>
      namiState({
        phase: "handend",
        raceScores: [NAMI_TARGET + 2, -12],
        runScore: NAMI_TARGET + 2,
        screen: {
          kind: "raceover",
          winner: 0,
          scores: [NAMI_TARGET + 2, -12],
          deals: 17,
        },
      }),
    () => <Screens />,
  ],
  [
    "the Nami match-over screen from the losing pair's seat",
    () =>
      namiState({
        phase: "handend",
        raceScores: [-12, NAMI_TARGET + 2],
        screen: {
          kind: "raceover",
          winner: 1,
          scores: [-12, NAMI_TARGET + 2],
          deals: 20,
        },
      }),
    () => <Screens />,
  ],
  ["the Politiikka rail", () => politicsState(), () => <Rail />],
  [
    "the Politiikka table and hand",
    () => {
      const g = politicsState();
      const hands = g.hands.slice() as GameState["hands"];
      hands[0] = [card("H", 12), ...hands[0].slice(1)];
      return { ...g, hands };
    },
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the Politiikka deal end",
    () => politicsState({ phase: "handend", screen: { kind: "dealend", score: 3 } }),
    () => <Screens />,
  ],
  [
    "the Politiikka match-over screen",
    () =>
      politicsState({
        phase: "handend",
        raceScores: [POLITIIKKA_TARGET + 4, -6],
        runScore: POLITIIKKA_TARGET + 4,
        screen: {
          kind: "raceover",
          winner: 0,
          scores: [POLITIIKKA_TARGET + 4, -6],
          deals: 13,
        },
      }),
    () => <Screens />,
  ],
  ["the Rock-Paper-Scissors rail", () => rpsState(), () => <Rail />],
  [
    "the Rock-Paper-Scissors throw panel",
    () => rpsState(),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the Rock-Paper-Scissors reveal",
    () => rpsState({ phase: "rpsreveal", rpsCards: [card("S", 6), card("D", 9)] }),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the Rock-Paper-Scissors reveal, tied",
    () => rpsState({ phase: "rpsreveal", rpsCards: [card("C", 4), card("C", 10)] }),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the Rock-Paper-Scissors reveal, an honour against foil",
    () => rpsState({ phase: "rpsreveal", rpsCards: [card("C", 13), card("C", 7)] }),
    () => [<Table key="t" />, <Hand key="h" />],
  ],
  [
    "the Rock-Paper-Scissors result, won",
    () =>
      rpsState({
        phase: "rpsreveal",
        rpsWins: [7, 4],
        rpsRound: RPS_ROUNDS,
        screen: { kind: "rpsover", result: "won", wins: [7, 4] },
      }),
    () => <Screens />,
  ],
  [
    "the Rock-Paper-Scissors result, lost",
    () =>
      rpsState({
        phase: "rpsreveal",
        rpsWins: [4, 7],
        rpsRound: RPS_ROUNDS,
        screen: { kind: "rpsover", result: "lost", wins: [4, 7] },
      }),
    () => <Screens />,
  ],
  /* The project's one drawn outcome, so it gets a sweep case of its own:
     equal wins after all twelve rounds. */
  [
    "the Rock-Paper-Scissors result, drawn",
    () =>
      rpsState({
        phase: "rpsreveal",
        rpsWins: [5, 5],
        rpsRound: RPS_ROUNDS,
        screen: { kind: "rpsover", result: "drawn", wins: [5, 5] },
      }),
    () => <Screens />,
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
  /* The join view reads window.innerWidth once, so its cases stub it; nothing
     else in here stubs a global, and a leak would be a width the next test
     never asked for. */
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(VIEWS)("renders %s", (label, state, ui) => {
    const { container } = renderWith(state(), ui(), locale);
    check(label, locale, container.textContent ?? "");
  });

  /* The two sooli fixtures above pass the generic leak sweep either way a
     mistaken team check reads — both need.sooli/need.sooliBust and
     need.sooliOther are real, translated strings, so a swapped comparison
     would not print undefined or a stray key. What has to be asserted by
     hand is which one shows: the mode box's "who is soloing" note, keyed off
     `you === sooliSeat`, is untouched by this spec, but the two new fixtures
     are the first main-run states where the soloist is never the viewer, so
     this is the first render coverage that would catch the note itself
     reading "you" for a bot's sooli. */
  it("never tells the viewing seat it is soloing when a bot is", () => {
    const opponentSoloed = loadedState({
      phase: "play",
      mode: "rami",
      ramSeat: 0,
      ramTeam: 0,
      sooli: true,
      sooliSeat: 1,
      sooliOrder: [0, 2, 1],
      leader: 0,
      turn: 0,
      tricks: [4, 3],
      hands: [
        [card("S", 5), card("H", 6)],
        [card("D", 9)],
        [card("C", 4), card("C", 5)],
        [],
      ] as GameState["hands"],
    });
    const own = renderWith(opponentSoloed, <App />, locale, 0);
    expect(own.container.textContent).not.toContain(translate(locale, "table.sooliNote"));
    expect(own.container.textContent).toContain(
      translate(locale, "table.sooliNoteTable", { who: SEATS[1].name }),
    );
    /* team 0 is the owner's own, and it is not the soloist's (team 1): the
       rail reads need.sooliOther, not need.sooli or need.sooliBust. */
    expect(own.container.textContent).toContain(translate(locale, "need.sooliOther"));
    expect(own.container.textContent).not.toContain(translate(locale, "need.sooliBust"));

    const partnerSoloed = loadedState({
      phase: "play",
      mode: "rami",
      ramSeat: 1,
      ramTeam: 1,
      sooli: true,
      sooliSeat: 2,
      sooliOrder: [1, 3, 2],
      leader: 1,
      turn: 1,
      tricks: [3, 4],
      hands: [
        [],
        [card("S", 7)],
        [card("D", 11)],
        [card("C", 6), card("C", 8)],
      ] as GameState["hands"],
    });
    const partner = renderWith(partnerSoloed, <App />, locale, 0);
    expect(partner.container.textContent).not.toContain(translate(locale, "table.sooliNote"));
    expect(partner.container.textContent).toContain(
      translate(locale, "table.sooliNoteTable", { who: SEATS[2].name }),
    );
    /* Here team 0 *is* the soloist's team, so the rail reads the ordinary
       sooli key rather than need.sooliOther. */
    expect(partner.container.textContent).toContain(translate(locale, "need.sooli", { won: 3 }));
    expect(partner.container.textContent).not.toContain(translate(locale, "need.sooliOther"));
  });

  /* The three sooli phases, in the main run, with a bot holding the offer.
     Panels, Hint and Hand each gated these on `challenge === "race" ||
     "tuppi"`, which was correct while only a match could reach them and went
     dead the moment the main run could: the window drew the whole SooliOffer
     panel — including a risk verdict computed from the *viewer's* hand for a
     decision another seat is making — and a click dispatched an action the
     reducer silently refuses, which is the control that lies MoveButton
     exists to forbid. Reachable in ordinary play for one aiSooli delay per
     phase. The fixtures above are all `phase: "play"`, so nothing looked. */
  it.each(["soolioffer", "sooligive", "sooliready"] as const)(
    "draws no sooli control in the main run while %s belongs to a bot",
    (phase) => {
      const botsTurn = loadedState({
        phase,
        mode: "rami",
        ramSeat: 0,
        ramTeam: 0,
        sooliSeat: 1,
        seats: ["human", "ai", "ai", "ai"] as GameState["seats"],
        hands: [
          [card("S", 13), card("H", 12), card("D", 11)],
          [card("C", 4)],
          [card("C", 5)],
          [card("C", 6)],
        ] as GameState["hands"],
      });
      const { container } = renderWith(botsTurn, <App />, locale, 0);
      for (const key of [
        "btn.playSooli",
        "btn.passSooli",
        "sooliGive.title",
        "sooliDone.title",
      ] as const)
        expect(container.textContent).not.toContain(translate(locale, key));
      /* The waiting line names the seat actually deciding, rather than the
         declare hint the dead gate let through. */
      expect(container.textContent).toContain(
        translate(locale, "hint.sooliWait", { who: SEATS[1].name }),
      );
    },
  );

  /* Hand.tsx carried the same dead gate, and the panel assertions above do not
     reach it: the hand is still drawn in sooligive (it is in SPREAD_PHASES), so
     the card is there to click even with every panel correctly withheld. A
     click dispatched sooliGive for the viewer's seat while a bot held the
     exchange, which the reducer then refused in silence. Mutating the fix back
     to `challenge === "race" || "tuppi"` left the whole suite green before this
     case existed. */
  it("refuses a card click in the main run while a bot holds the sooli exchange", () => {
    const botsExchange = loadedState({
      phase: "sooligive",
      mode: "rami",
      ramSeat: 0,
      ramTeam: 0,
      sooliSeat: 1,
      seats: ["human", "ai", "ai", "ai"] as GameState["seats"],
      hands: [
        [card("S", 13), card("H", 12)],
        [card("C", 4)],
        [card("C", 5)],
        [card("C", 6)],
      ] as GameState["hands"],
    });
    const mine = renderWith(botsExchange, <Hand />, locale, 0);
    fireEvent.click(mine.container.querySelector(".hcard")!);
    expect(mine.dispatch).not.toHaveBeenCalled();
    mine.unmount();

    /* Vacuity guard: the same click on the seat that does hold the exchange
       still dispatches, so the silence above is the gate and not the fixture. */
    const ours = loadedState({
      phase: "sooligive",
      mode: "rami",
      ramSeat: 1,
      ramTeam: 1,
      sooliSeat: 0,
      seats: ["human", "ai", "ai", "ai"] as GameState["seats"],
      hands: [
        [card("S", 13), card("H", 12)],
        [card("C", 4)],
        [card("C", 5)],
        [card("C", 6)],
      ] as GameState["hands"],
    });
    const yours = renderWith(ours, <Hand />, locale, 0);
    fireEvent.click(yours.container.querySelector(".hcard")!);
    expect(yours.dispatch).toHaveBeenCalledExactlyOnceWith({
      type: "sooliGive",
      p: 0,
      uid: ours.hands[0][0].uid,
    });
  });

  /* The vacuity guard: the same phase with the offer on the viewer's own seat
     must still draw its controls, or the assertions above would pass on a
     panel that had simply stopped rendering. */
  it("still draws the sooli offer in the main run when it is the viewer's own", () => {
    const yours = loadedState({
      phase: "soolioffer",
      mode: "rami",
      ramSeat: 1,
      ramTeam: 1,
      sooliSeat: 0,
      seats: ["human", "ai", "ai", "ai"] as GameState["seats"],
      hands: [
        [card("S", 14), card("H", 2)],
        [card("C", 4)],
        [card("C", 5)],
        [card("C", 6)],
      ] as GameState["hands"],
    });
    const { container } = renderWith(yours, <App />, locale, 0);
    expect(container.textContent).toContain(translate(locale, "btn.playSooli"));
    expect(container.textContent).not.toContain(
      translate(locale, "hint.sooliWait", { who: SEATS[0].name }),
    );
  });

  /* The three result screens ask the rail's own question — whose sooli was it
     — and until a bot could solo, a main run could never reach a screen
     reporting a sooli the viewer's pair had not played. Both sides of every
     gate are asserted, because a check stuck at one value passes a one-sided
     test. sooliBust rides along on the two `why` screens so the opponent's
     line has to beat the bust line in the order the code puts them. */
  const soloedRun = (sooliSeat: Seat, over: StateOver = {}) =>
    loadedState({
      phase: "handend",
      mode: "rami",
      ramSeat: 0,
      ramTeam: 0,
      sooli: true,
      sooliSeat,
      sooliBust: true,
      tricks: [4, 3],
      ...over,
    });

  const RESULT_SOOLI: Array<[string, Screen, LocaleKey, LocaleKey]> = [
    ["the deal-end screen", { kind: "dealend", score: 0 }, "why.sooliOther", "why.sooliBust"],
    ["the game-over screen", { kind: "gameover" }, "over.sooliOther", "over.sooliBust"],
  ];

  it.each(RESULT_SOOLI)(
    "says on %s that the other pair played alone",
    (_l, screen, other, bust) => {
      const theirs = renderWith(soloedRun(1, { screen }), <Screens />, locale, 0);
      expect(theirs.container.textContent).toContain(translate(locale, other));
      expect(theirs.container.textContent).not.toContain(translate(locale, bust));

      /* Seat 1 is the soloist's own chair: that pair still reads the bust line
       it always has, so the new branch cannot have swallowed the old one. */
      const ours = renderWith(soloedRun(1, { screen }), <Screens />, locale, 1);
      expect(ours.container.textContent).toContain(translate(locale, bust));
      expect(ours.container.textContent).not.toContain(translate(locale, other));
    },
  );

  /* The $6 bonus belongs to the soloist's pair, so a deal the opponents
     soloed heads the cash-out with the ordinary rami line and labels its
     bonus row accordingly. Asserted against the elements rather than the
     whole text: the bonus label is a substring of the sooli heading in both
     languages, so a text search would pass either way round. */
  const CASH_SOOLI: Array<[Seat, LocaleKey, LocaleKey]> = [
    [0, "cash.rami", "cash.overTricks"],
    [1, "cash.sooli", "cash.sooliBonus"],
  ];

  it.each(CASH_SOOLI)(
    "heads the cash-out seen from seat %i by whose sooli it was",
    (seat, head, bonus) => {
      const g = soloedRun(1, {
        sooliBust: false,
        screen: {
          kind: "cashout",
          score: 1200,
          reward: 4,
          bonus: seat === 0 ? 0 : 6,
          interest: 2,
          spare: 1,
          bank: 26,
        },
      });
      const { container } = renderWith(g, <Screens />, locale, seat);
      expect(container.querySelector("h2")?.textContent).toBe(translate(locale, head));
      const labels = [...container.querySelectorAll(".cashline span")].map((s) => s.textContent);
      expect(labels[1]).toBe(translate(locale, bonus));
    },
  );
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

  /* Every suit now has its own colour instead of sharing one of two, so the
     card root's class is what proves it: four suits, four distinct classes,
     and the retired two-colour class gone for good. */
  it("gives each suit its own class, distinct from the others", () => {
    const cards = (["S", "H", "D", "C"] as const).map((s) => card(s, 7));
    const { container } = renderWith(
      loadedState(),
      <>
        {cards.map((c) => (
          <PlayingCard key={c.uid} card={c} />
        ))}
      </>,
      locale,
    );
    const roots = [...container.querySelectorAll<HTMLElement>(".card")];
    expect(roots).toHaveLength(4);
    const suitClasses = roots.map((el) => [...el.classList].find((cls) => /^s-[SHDC]$/.test(cls))!);
    expect(suitClasses.every(Boolean)).toBe(true);
    expect(new Set(suitClasses).size).toBe(4);
    expect(container.querySelector(".card.red")).toBeNull();
  });

  /* Traditional Tuppi and the Tuppi Race are dealt from a physical two-colour
     deck: the card root gains "trad" on top of its own suit class, never in
     place of it. */
  it.each([
    ["Traditional Tuppi", "tuppi"],
    ["the Tuppi Race", "race"],
  ] as const)("marks every suit trad in %s", (_label, challenge) => {
    const cards = (["S", "H", "D", "C"] as const).map((s) => card(s, 7));
    const { container } = renderWith(
      loadedState({ challenge }),
      <>
        {cards.map((c) => (
          <PlayingCard key={c.uid} card={c} />
        ))}
      </>,
      locale,
    );
    const roots = [...container.querySelectorAll<HTMLElement>(".card")];
    expect(roots).toHaveLength(4);
    const suitClasses = roots.map((el) => {
      expect(el.classList.contains("trad")).toBe(true);
      return [...el.classList].find((cls) => /^s-[SHDC]$/.test(cls));
    });
    /* trad is added beside the suit class, never in place of it, so the four
       cards still carry four different s-* classes. */
    expect(suitClasses.every(Boolean)).toBe(true);
    expect(new Set(suitClasses).size).toBe(4);
  });

  /* The other seven states keep the four-colour deck. Spelled out rather
     than derived from PlayingCard's own predicate, so a mistake in that
     predicate cannot pass by agreeing with itself. */
  it.each(["tupatro", "nami", "namihard", "rps", "rummikub", "politiikka", null] as const)(
    "gives no card trad when challenge is %s",
    (challenge) => {
      const c = card("H", 7);
      const { container } = renderWith(
        loadedState({ challenge }),
        <PlayingCard card={c} />,
        locale,
      );
      expect(container.querySelector(".card")?.classList.contains("trad")).toBe(false);
    },
  );

  /* A stone card plays with no suit, so it carries none of the four suit
     classes — the early return in PlayingCard never reaches the line that
     would add one. */
  it("gives a stone card none of the four suit classes", () => {
    const c = card("S", 14, "stone");
    const { container } = renderWith(loadedState(), <PlayingCard card={c} />, locale);
    const root = container.querySelector(".card.e-stone")!;
    expect(root).not.toBeNull();
    expect([...root.classList].some((cls) => /^s-[SHDC]$/.test(cls))).toBe(false);
  });

  /* The sharpener voucher's bonus sits in a wallet, so the chip number on a
     card is what the card is worth *to the seat looking at it*. Two seats with
     different wallets and the same card, so a hardcoded seat prints one of the
     two numbers where the other belongs. */
  it("prints the chip value from the viewing seat's wallet", () => {
    const c = card("H", 7);
    const g = withEcon(withEcon(loadedState(), 0, { chipBonus: 2 }), 1, { chipBonus: 30 });
    const chipAt = (seat: Seat) =>
      renderWith(g, <PlayingCard card={c} />, locale, seat).container.querySelector(".chip")
        ?.textContent;
    expect(chipAt(0)).toBe("+9");
    expect(chipAt(1)).toBe("+37");
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
    /* The multiplayer list is drawn after the parties', so "the last list" is
       no longer the parties'. */
    const lists = container.querySelectorAll(".rules ul:not(.mplist)");
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
      { id: 6, key: "toast.ikiliikkuja", nameKey: CONSUMABLES[0].key, p: 0 },
      { id: 7, key: "toast.ikiliikkujaFull", p: 0 },
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

  /* A temppu's toast is addressed to the seat that spent it. Broadcasting
     toast.theftArmed would tell the opponents the next trick is stolen, which
     is exactly what the toast is arming. */
  it("draws the theft toast on the spender's window and on no other", () => {
    const toast: GameState["toast"] = { id: 1, key: "toast.theftArmed", p: 2 };

    const spender = renderWith(loadedState({ toast }), <Toasts />, locale, 2);
    expect(spender.container.textContent).toContain(translate(locale, "toast.theftArmed"));
    spender.unmount();

    const other = renderWith(loadedState({ toast }), <Toasts />, locale, 0);
    expect(other.container.textContent ?? "").toBe("");
    other.unmount();

    const table = renderWith(
      loadedState({ toast }),
      <Toasts />,
      locale,
      0,
      stubNet({ role: "table", live: true, seat: null, status: "live" }),
    );
    expect(table.container.textContent ?? "").toBe("");
  });

  /* Ikiliikkuja's kept-draw toast names the drawn temppu, which is only safe
     because it is addressed: it must not reach another seat's window or the
     shared table, exactly like the theft toast above. */
  it("draws the Ikiliikkuja toast on the playing seat's window and on no other", () => {
    const toast: GameState["toast"] = {
      id: 1,
      key: "toast.ikiliikkuja",
      nameKey: CONSUMABLES[0].key,
      p: 2,
    };

    const player = renderWith(loadedState({ toast }), <Toasts />, locale, 2);
    expect(player.container.textContent).toContain(
      translate(locale, "toast.ikiliikkuja", { name: nameOfIn(locale, CONSUMABLES[0]) }),
    );
    player.unmount();

    const other = renderWith(loadedState({ toast }), <Toasts />, locale, 0);
    expect(other.container.textContent ?? "").toBe("");
    other.unmount();

    const table = renderWith(
      loadedState({ toast }),
      <Toasts />,
      locale,
      0,
      stubNet({ role: "table", live: true, seat: null, status: "live" }),
    );
    expect(table.container.textContent ?? "").toBe("");
  });

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
  it.each(["swap", "declare", "sooligive", "sooliready", "play", "laydown"] as Phase[])(
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

  /* Temppukielto shuts the tricks, and the box says so before the click rather
     than answering it with a toast. Both directions are asserted, because a
     hard-coded `disabled` would pass the first half on its own. */
  it.each([
    ["temppukielto", true],
    [null, false],
  ] as const)("disables the trick buttons under boss %s", (id, shut) => {
    const boss = id === null ? null : (BOSSES.find((b) => b.id === id) ?? null);
    const { container } = renderWith(loadedState({ boss }), <Rail />, locale);
    const btns = [...container.querySelectorAll<HTMLButtonElement>(".consbtn")];
    expect(btns.length).toBeGreaterThan(0);
    expect(btns.map((b) => b.disabled)).toEqual(btns.map(() => shut));
    const note = translate(locale, "rail.tricksBanned");
    expect((container.textContent ?? "").includes(note)).toBe(shut);
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
     label and in order: the column is a decision list, and the one question it
     asks is whether you are playing alone. */
  const menuBtns = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLElement>(".menubtns button"),
  ];

  it("draws the menu's four buttons in order", () => {
    const g = loadedState({ menu: "start", runStarted: true });
    const { container } = renderWith(g, <Screens />, locale);
    const btns = menuBtns(container);
    const other = locale === "fi" ? "en" : "fi";
    expect(btns.map((b) => b.textContent)).toEqual([
      translate(locale, "btn.singlePlayer"),
      translate(locale, "btn.multiplayer"),
      translate(locale, "btn.rules"),
      LOCALE_NAMES[other],
    ]);
    /* Two groups, and the descendant selector above still reaches every
       button through them: the return moved into the lobby. */
    expect(container.querySelectorAll(".menubtns .menugroup")).toHaveLength(2);
  });

  /* Two doors and nothing else: the roguelike, Tuppi-Rummikub and the two
     match modes played against the game are behind Single player, and
     everything played with other people is behind Multiplayer. The
     transport's own controls stay in the lobby — in either language, since a
     button labelled from the other one would be just as reachable. */
  it("opens single player and the lobby, and offers no transport of its own", () => {
    const g = loadedState({ menu: "start", runStarted: true });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const labels = menuBtns(container).map((b) => b.textContent);
    for (const loc of LOCALE_ORDER)
      for (const key of ["btn.hostGame", "btn.hangUp", "btn.startMatch", "btn.joinGame"] as const)
        expect(labels).not.toContain(translate(loc, key));

    for (const [key, view] of [
      ["btn.singlePlayer", "single"],
      ["btn.multiplayer", "lobby"],
    ] as const) {
      const btn = menuBtns(container).filter((b) => b.textContent === translate(locale, key));
      expect(btn).toHaveLength(1);
      expect((btn[0] as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(btn[0]);
      expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view });
    }
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "newRun")).toEqual([]);
  });

  /* Continue left the menu for the screen behind Single player, and it is
     checked against both catalogues: a button labelled from the other language
     would still be a Continue leading nowhere. */
  it("offers no Continue on the menu at all", () => {
    for (const runStarted of [false, true]) {
      const g = loadedState({ menu: "start", runStarted });
      const { container, unmount } = renderWith(g, <Screens />, locale);
      const labels = menuBtns(container).map((b) => b.textContent);
      expect(labels).toHaveLength(4);
      for (const loc of LOCALE_ORDER) expect(labels).not.toContain(translate(loc, "btn.continue"));
      unmount();
    }
  });

  /* Rules is the only reading matter on the menu now: the board went down
     behind Single player with the run it records, and is checked for in both
     catalogues so a label from the other language cannot hide there. */
  it("opens the rules from the menu, and offers no board", () => {
    const g = loadedState({ menu: "start", runStarted: true });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const btns = menuBtns(container);
    const at = (label: string) => btns.filter((b) => b.textContent === label)[0];
    fireEvent.click(at(translate(locale, "btn.rules")));
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: "openModal", modal: "rules" }]);
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    for (const loc of LOCALE_ORDER) expect(labels).not.toContain(translate(loc, "btn.scores"));
  });

  /* ---------- the single-player screen ---------- */

  /* Three controls above the list, and each dispatches exactly one thing. The
     new-run button is the one action on the screen that destroys a run, so it
     confirms first whenever there is one to lose and starts straight away when
     there is not. */
  it.each([false, true])(
    "draws the single-player screen's own controls with runStarted %s",
    (runStarted) => {
      const g = loadedState({ menu: "single", runStarted });
      const { container, dispatch } = renderWith(g, <Screens />, locale);
      const text = container.textContent ?? "";
      expect(text).toContain(translate(locale, "single.title"));
      expect(text).toContain(translate(locale, "single.dek"));
      expect(text).toContain(translate(locale, "single.modes"));

      const at = (key: LocaleKey) =>
        [...container.querySelectorAll<HTMLElement>("button")].filter(
          (b) => b.textContent === translate(locale, key),
        );
      expect(at("btn.continue")).toHaveLength(runStarted ? 1 : 0);
      if (runStarted) {
        fireEvent.click(at("btn.continue")[0]);
        expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: "closeMenu" }]);
        dispatch.mockClear();
      }
      expect(at("btn.newGame")).toHaveLength(1);
      fireEvent.click(at("btn.newGame")[0]);
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
        runStarted ? { type: "openModal", modal: "restart" } : { type: "newRun" },
      ]);
      dispatch.mockClear();

      /* The board is the solo roguelike's own top ten, so it is here rather
         than on the menu — in the footer with Back, apart from everything
         above it that starts a game. */
      expect(at("btn.scores")).toHaveLength(1);
      expect(at("btn.scores")[0].closest(".singlefoot")).not.toBeNull();
      fireEvent.click(at("btn.scores")[0]);
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
        { type: "openModal", modal: "scores" },
      ]);
      dispatch.mockClear();

      expect(at("btn.back")).toHaveLength(1);
      fireEvent.click(at("btn.back")[0]);
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: "showMenu", view: "start" }]);
    },
  );

  /* Every alternate rule set, with no id filter: each is started against
     bots from here, and each match mode's multi-human form is the lobby's. */
  it("lists every rule set and starts each by its own id", () => {
    const { container, dispatch } = renderWith(
      loadedState({ menu: "single" }),
      <Screens />,
      locale,
    );
    const text = container.textContent ?? "";
    const rows = [...container.querySelectorAll("li.chalrow")];
    /* Seven of the eight CHALLENGES rows: Tupatro is multiplayer-only, because
       only a "human" seat draws a temppu and no bot spends one, so a solo board
       would be lopsided by construction. Nami and its hard variant,
       Rock-Paper-Scissors and Politiikka are single-player-only in the other
       direction and stay — each mode's own bots play it exactly like any
       other seat, with no wallet to sit lopsided. The ids are spelled out
       rather than derived from the component's own filter, which would pass
       whatever that filter happened to do. */
    const solo = CHALLENGES.filter((c) =>
      ["rummikub", "race", "tuppi", "nami", "namihard", "rps", "politiikka"].includes(c.id),
    );
    expect(solo).toHaveLength(7);
    expect(rows).toHaveLength(7);
    expect(CHALLENGES).toHaveLength(8);
    for (const c of solo) {
      expect(text).toContain(nameOfIn(locale, c));
      expect(text).toContain(descOfIn(locale, c));
    }
    const tupatro = CHALLENGES.find((c) => c.id === "tupatro")!;
    expect(text).not.toContain(nameOfIn(locale, tupatro));
    expect(text).not.toContain(descOfIn(locale, tupatro));

    solo.forEach((c, i) => {
      expect(rows[i].querySelector(".chalglyph")?.textContent).toBe(c.g);
      const play = [...rows[i].querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.play"),
      );
      expect(play).toHaveLength(1);
      fireEvent.click(play[0]);
      /* No seats: a single-human board, built from the owner's own chair. */
      expect(dispatch).toHaveBeenCalledWith({ type: "startChallenge", id: c.id });
    });
    expect(dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "newRun")).toEqual([]);
  });

  /* The screen knows nothing about the network: no session state is drawn, no
     lobby prose leaks into it, and the gate is the door upstairs. */
  it("draws nothing about the network on the single-player screen", () => {
    const { container } = renderWith(
      loadedState({ menu: "single", runStarted: true }),
      <Screens />,
      locale,
      0,
      stubNet({ role: "host", live: true, seat: 0 }),
    );
    for (const sel of [".seatpick", ".roominput", ".codebox", ".netescape", ".lobbymode"])
      expect(container.querySelector(sel)).toBeNull();
    const text = container.textContent ?? "";
    for (const loc of LOCALE_ORDER)
      for (const key of [
        "lobby.name",
        "lobby.roomTitle",
        "lobby.roomRelay",
        "lobby.readable",
      ] as const)
        expect(text).not.toContain(translate(loc, key));
  });

  /* The restart confirmation belongs to the destructive click again, and the
     destructive click is the single-player screen's new-run button. The dialog
     dispatches the run itself — no session in between — and cancelling returns
     to the screen underneath, which is still menu: "single". */
  it("confirms a restart with newRun and cancels back to the single-player screen", () => {
    const g = loadedState({ menu: "single", modal: "restart", runStarted: true });
    const { container, dispatch, net } = renderWith(g, <Screens />, locale);
    const btns = [...container.querySelectorAll<HTMLElement>("button")];
    const labels = btns.map((b) => b.textContent);
    expect(labels).toContain(translate(locale, "btn.cancel"));
    expect(labels).not.toContain(translate(locale, "btn.continue"));
    fireEvent.click(btns[labels.indexOf(translate(locale, "btn.yesRestart"))]);
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: "newRun" }]);
    expect(net.start).not.toHaveBeenCalled();
    dispatch.mockClear();

    fireEvent.click(btns[labels.indexOf(translate(locale, "btn.cancel"))]);
    expect(dispatch).toHaveBeenCalledWith({ type: "closeModal" });
    expect(gameReducer(g, { type: "closeModal" }).menu).toBe("single");
  });

  /* The inverse of the case the seat-picker removal installed, read the way it
     was first written: `newRun` is dispatched from a menu-side button and from
     the restart confirmation, and from nowhere else on the menu itself. */
  it("dispatches no newRun from the start menu", () => {
    for (const [g, label] of [
      [loadedState({ menu: "start", runStarted: true }), "btn.singlePlayer"],
      [loadedState({ menu: "start", runStarted: false }), "btn.singlePlayer"],
      [loadedState({ menu: "start", runStarted: true }), "btn.multiplayer"],
      [loadedState({ menu: "single", modal: "restart" }), "btn.cancel"],
    ] as const) {
      const { container, dispatch, unmount } = renderWith(g, <Screens />, locale);
      const btn = [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, label),
      );
      expect(btn).toHaveLength(1);
      fireEvent.click(btn[0]);
      expect(dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "newRun")).toEqual([]);
      unmount();
    }
  });

  /* ---------- the lobby ---------- */
  /* Every route out of the lobby is a button carrying a catalogue label, so
     the label is what a test presses — in whichever language it is drawing. */
  const labelled = (c: HTMLElement, key: LocaleKey) =>
    [...c.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => b.textContent === translate(locale, key),
    );
  const press = (c: HTMLElement, key: LocaleKey) => fireEvent.click(labelled(c, key)[0]);
  /* The room's code box, reached the way a player reaches it: the table's own
     Join a game. It is a view inside the lobby and not a menu state — there
     was a `menu: "join"` once and nothing ever dispatched it, so a test that
     set it by hand was asserting about a window no player could be in. */
  const joinPage = (over: Partial<GameState> = {}, net?: Net) => {
    const r = renderWith(loadedState({ menu: "lobby", ...over }), <Screens />, locale, 0, net);
    press(r.container, "btn.joinGame");
    return r;
  };

  /* The host-setup step, reached the way a player reaches it: the landing
     page's own Open a room, which now navigates rather than acting. This is
     where the name field, the mode picker and the real net.openRoom() call
     live now. */
  const hostSetup = (over: Partial<GameState> = {}, net?: Net) => {
    const r = renderWith(loadedState({ menu: "lobby", ...over }), <Screens />, locale, 0, net);
    press(r.container, "btn.openRoom");
    return r;
  };

  /* Nobody picks a chair before a room exists. The page's own line says the
     host places every player once they have joined, and the roster below is
     where that happens: a You / Open / AI table drawn here decided nothing on
     the room route — openRoom() throws every kind away — and offering it was
     the page contradicting its own instructions. The landing page asks only
     which route now: the name and the mode moved one step down, onto the
     host-setup page Open a room navigates to. */
  it("picks no chair before a room exists", () => {
    const { container, dispatch } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    expect(container.querySelector("h2")?.textContent).toBe(translate(locale, "lobby.title"));
    expect(container.querySelector(".seatpick")).toBeNull();
    expect(container.querySelector(".kind[data-kind]")).toBeNull();
    /* The landing page holds neither the name nor the mode any more — both
       moved to the host-setup page. */
    expect(container.querySelector(".roominput")).toBeNull();
    expect(container.querySelector(".lobbymode")).toBeNull();
    expect(labelled(container, "btn.openRoom")).toHaveLength(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  /* The landing page is a title, a dek and the four ways out, and nothing
     else — the name field, the mode picker and its best line all moved one
     step down, onto the host-setup page Open a room now opens. */
  it("holds a title, a dek and four footer controls on the landing page, and nothing else", () => {
    const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    expect(container.querySelector("h2")?.textContent).toBe(translate(locale, "lobby.title"));
    expect(container.textContent).toContain(translate(locale, "lobby.dek"));
    for (const sel of [
      ".roominput",
      "input",
      ".lobbymode",
      ".modepicks",
      ".netlabel",
      ".seatpick",
      ".joinas",
    ])
      expect(container.querySelector(sel)).toBeNull();
    /* Screens draws the lobby alone here, so every button on the page is one
       of the four in .lobbyfoot. */
    expect(container.querySelectorAll("button")).toHaveLength(4);
  });

  /* The mode's best result line is read where the mode is picked now, not on
     the landing page — an empty board would otherwise print
     challenges.noBest on a page with no picker to explain it. */
  it("leaves the mode's best line off the landing page", () => {
    const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    expect(container.textContent).not.toContain(translate(locale, "challenges.noBest"));
    expect(container.textContent).not.toContain(translate(locale, "race.bestWon", { deals: "1" }));
  });

  /* Open a room stopped acting from the landing page: it only opens the
     host-setup page now, and the real action — and every gate that used to
     apply to it — moved down with the field it depends on. */
  it("navigates from the landing page's Open a room without acting", () => {
    const { container, dispatch, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      stubNet({ name: "" }),
    );
    const button = labelled(container, "btn.openRoom")[0];
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(net.openRoom).not.toHaveBeenCalled();
    expect(net.enterRoom).not.toHaveBeenCalled();
    expect(net.invite).not.toHaveBeenCalled();
    expect(net.start).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  /* The host-setup page is where the name, the mode and the board live now. */
  it("holds the name, the mode and the board on the host-setup page", () => {
    const { container } = hostSetup();
    expect(container.querySelector(".roominput")).not.toBeNull();
    expect(container.querySelector(".lobbymode")).not.toBeNull();
    expect(container.textContent).toContain(translate(locale, "lobby.name"));
    expect(container.textContent).toContain(translate(locale, "lobby.nameHint"));
    const race = container.querySelector<HTMLElement>('.modepicks button[data-mode="race"]');
    const trad = container.querySelector<HTMLElement>('.modepicks button[data-mode="tuppi"]');
    const tupatro = container.querySelector<HTMLElement>('.modepicks button[data-mode="tupatro"]');
    expect(race).not.toBeNull();
    expect(trad).not.toBeNull();
    expect(tupatro?.className).toContain("on");
  });

  /* Its Open a room is the real one, and gated on the name the way the
     landing page's never was — that field is on this page now. */
  it("gates the host-setup page's Open a room on the name", () => {
    const empty = hostSetup({}, stubNet({ name: "" }));
    const emptyBtn = labelled(empty.container, "btn.openRoom")[0];
    expect(emptyBtn.disabled).toBe(true);
    fireEvent.click(emptyBtn);
    expect(empty.net.openRoom).not.toHaveBeenCalled();

    const filled = hostSetup({}, stubNet({ name: "Host" }));
    const filledBtn = labelled(filled.container, "btn.openRoom")[0];
    expect(filledBtn.disabled).toBe(false);
    fireEvent.click(filledBtn);
    expect(filled.net.openRoom).toHaveBeenCalledTimes(1);
    expect(filled.net.openRoom).toHaveBeenCalledWith();
    expect(filled.dispatch).not.toHaveBeenCalled();
  });

  /* Its footer is exactly two controls, Open a room then Back — the shape
     the join page already has. */
  it("gives the host-setup page a two-button footer, Open a room then Back", () => {
    const { container, dispatch } = hostSetup();
    const foot = container.querySelector<HTMLElement>(".lobbyfoot")!;
    expect([...foot.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      translate(locale, "btn.openRoom"),
      translate(locale, "btn.back"),
    ]);
    press(container, "btn.back");
    expect(labelled(container, "btn.openRoom")).toHaveLength(1);
    expect(container.querySelector(".lobbymode")).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    press(container, "btn.back");
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });

  /* Opening the lobby is one click from a hosted match, and Multiplayer
     Tupatro is the mode that click starts unless the host picks another. */
  it("opens with Multiplayer Tupatro picked", () => {
    const { container } = hostSetup();
    expect(
      container.querySelector<HTMLElement>('.modepicks button[data-mode="tupatro"]')?.className,
    ).toContain("on");
  });

  /* The mode the lobby starts is picked where it is started, and there are
     three of them: all alternate rule sets with their own CHALLENGES rows.
     The roguelike is not offered here at all — it is a one-player game and
     the single-player screen is its door — and `MatchId` is what makes that a
     compile error rather than a filtered option. */
  it("draws a button per match mode and describes the chosen one", () => {
    const race = CHALLENGES.find((c) => c.id === "race")!;
    const trad = CHALLENGES.find((c) => c.id === "tuppi")!;
    const tupatro = CHALLENGES.find((c) => c.id === "tupatro")!;
    const { container } = hostSetup();
    const mode = container.querySelector(".lobbymode");
    expect(
      [...(mode?.querySelectorAll(".modepicks button") ?? [])].map((b) => b.textContent),
    ).toEqual([nameOfIn(locale, tupatro), nameOfIn(locale, race), nameOfIn(locale, trad)]);
    /* The default is Multiplayer Tupatro, so its description is the one
       drawn — and the other modes' are not, or the picker would describe
       more than one at once. */
    expect(mode?.textContent).toContain(descOfIn(locale, tupatro));
    expect(mode?.textContent).not.toContain(descOfIn(locale, race));
    expect(mode?.textContent).not.toContain(descOfIn(locale, trad));
    /* No mode is refused here any more: the gate the lobby carried was the
       roguelike's, and the roguelike left with its door. */
    for (const id of ["race", "tuppi", "tupatro"] as const)
      expect(
        mode?.querySelector<HTMLButtonElement>(`.modepicks button[data-mode="${id}"]`)?.disabled,
      ).toBe(false);
  });

  /* Nothing in the lobby raises a confirmation now: both modes park the run
     behind the menu rather than destroying it, so a click that says nothing
     would cost every replay a dialog. The one action that does destroy a run
     moved to the single-player screen with the roguelike. */
  it.each([false, true])("starts a match with no dialog, runStarted %s", (runStarted) => {
    for (const match of ["race", "tuppi", "tupatro"] as const) {
      /* A host whose one open chair has answered: Start belongs to a page
         with a session behind it, and the page before one exists has none. */
      const net = { ...hostingNet({ state: "connected" }), match };
      const { container, dispatch, unmount } = renderWith(
        loadedState({ menu: "lobby", runStarted }),
        <Screens />,
        locale,
        0,
        net,
      );
      press(container, "btn.startMatch");
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([]);
      expect(net.start).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it("describes the traditional mode once the picker is on it", () => {
    const trad = CHALLENGES.find((c) => c.id === "tuppi")!;
    const { container } = hostSetup({}, stubNet({ match: "tuppi" }));
    const mode = container.querySelector(".lobbymode");
    expect(mode?.textContent).toContain(descOfIn(locale, trad));
    expect(
      mode?.querySelector<HTMLElement>('.modepicks button[data-mode="tuppi"]')?.className,
    ).toContain("on");
  });

  /* A click on the picker is the session's to record — the chosen mode lives
     on the net context beside the chair plan, never on GameState. */
  it("asks the session to change mode and dispatches nothing", () => {
    const { container, dispatch, net } = hostSetup();
    fireEvent.click(container.querySelector<HTMLElement>('.modepicks button[data-mode="tuppi"]')!);
    expect(net.setMatch).toHaveBeenCalledWith("tuppi");
    expect(dispatch).not.toHaveBeenCalled();
  });

  /* And Start begins whichever the picker shows: the mode rides in start()'s
     own action, so the value used on the click has to be the one on screen. */
  it("starts the mode the picker is showing", () => {
    const net = { ...hostingNet({ state: "connected" }), match: "tuppi" as const };
    const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, net);
    fireEvent.click(container.querySelector<HTMLElement>('.modepicks button[data-mode="tuppi"]')!);
    const start = [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => b.textContent === translate(locale, "btn.startMatch"),
    );
    fireEvent.click(start[0]);
    expect(net.start).toHaveBeenCalled();
  });

  /* Start belongs to a host with a session. The one this page used to draw
     had no peer to wait for, so it dispatched straight to the reducer and
     began a match against three bots — the single-player screen's own two
     rows, minus the confirmation they ask before replacing a saved match. A
     page that configures a room starts nothing. */
  it("offers no Start before a session exists", () => {
    const { container, dispatch, net } = renderWith(
      loadedState({ menu: "lobby", runStarted: false }),
      <Screens />,
      locale,
    );
    /* In both languages: a button labelled from the other one would be just
       as clickable. */
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    for (const loc of LOCALE_ORDER)
      for (const key of ["btn.startMatch", "btn.startAlone"] as const)
        expect(labels).not.toContain(translate(loc, key));
    /* Not merely unlabelled: no button on the page starts a match at all.
       Two of the four now navigate (Open a room, Join a game), which
       re-renders the footer mid-loop and detaches the remaining nodes from
       React's event delegation — a click on one of those would silently do
       nothing rather than prove anything. A fresh render per button keeps
       every click live. */
    for (const key of ["btn.openRoom", "btn.joinGame", "btn.otherWays", "btn.back"] as const) {
      const fresh = renderWith(
        loadedState({ menu: "lobby", runStarted: false }),
        <Screens />,
        locale,
      );
      press(fresh.container, key);
      expect(fresh.net.start).not.toHaveBeenCalled();
      expect(
        fresh.dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "startChallenge"),
      ).toEqual([]);
    }
    expect(net.start).not.toHaveBeenCalled();
    expect(dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "startChallenge")).toEqual(
      [],
    );
    /* Vacuity guard: a host whose chair has answered does draw one. */
    const host = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      hostingNet({ state: "connected" }),
    );
    expect(labelled(host.container, "btn.startMatch")).toHaveLength(1);
  });

  /* Four buttons, and each of them names the route it takes: the room is the
     way to connect, the second route is one level down behind Other ways to
     connect, and joining is offered here too — the menu no longer keeps a
     view between itself and this table. Start is not among them: with no
     session there is no peer to start with, and playing alone is behind
     Single player. */
  it("offers four buttons on the chair table and names the route each takes", () => {
    const { container, dispatch, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
    );
    const foot = container.querySelector<HTMLElement>(".lobbyfoot")!;
    expect([...foot.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      translate(locale, "btn.openRoom"),
      translate(locale, "btn.joinGame"),
      translate(locale, "btn.otherWays"),
      translate(locale, "btn.back"),
    ]);
    /* Offline there is nothing to hang up, in either language: a button
       labelled from the other one would be just as clickable. */
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    for (const loc of LOCALE_ORDER)
      for (const key of ["btn.hostGame", "btn.hangUp"] as const)
        expect(labels).not.toContain(translate(loc, key));

    press(container, "btn.joinGame");
    /* The page is component-local state, so joining from here dispatches
       nothing and enters no room until the code is typed. */
    expect(dispatch).not.toHaveBeenCalled();
    expect(net.enterRoom).not.toHaveBeenCalled();
    expect(container.querySelector("#roomcode")).not.toBeNull();
    /* And its Back is this table, one step out rather than all the way: the
       lobby is left from here, by the button this test started on. */
    press(container, "btn.back");
    expect(dispatch).not.toHaveBeenCalled();
    expect(container.querySelector("#roomcode")).toBeNull();
    press(container, "btn.back");
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });

  /* A guest does not choose the mode: it arrives with the host's numbered
     startChallenge, so a picker here would be a control that lies and a best
     line beside it would describe a mode the guest may not be about to
     play. */
  it("draws no mode picker on the join page", () => {
    const { container } = joinPage();
    expect(container.querySelector(".lobbymode")).toBeNull();
  });

  /* Other ways to connect is the fallback for when the room route isn't
     usable, not a peer of Open a room / Join a game, so it alone drops the
     "btn" class in favour of the text-link one — the other three neighbours
     are asserted unmoved in the same breath. */
  it("draws Other ways to connect as a link, not a button, in the chair table's footer", () => {
    const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    const foot = container.querySelector<HTMLElement>(".lobbyfoot")!;
    expect([...foot.querySelectorAll("button")].map((b) => b.className)).toEqual([
      "btn",
      "btn ghost",
      "linkbtn",
      "btn ghost",
    ]);
  });

  it("reaches the code swap from the chair table without starting it", () => {
    const { container, dispatch, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
    );
    press(container, "btn.otherWays");
    /* The page is component-local state, so nothing about it reaches the
       store — and the route it leads to is not started by reaching it. */
    expect(dispatch).not.toHaveBeenCalled();
    expect(net.invite).not.toHaveBeenCalled();
    expect(container.querySelector(".methods")).not.toBeNull();
    /* The page it left is the landing page, not the host-setup one — the
       .lobbymode assertion this test used to make is vacuous now, since the
       landing page never drew one either. */
    expect(labelled(container, "btn.openRoom")).toHaveLength(0);
  });

  /* Both sides of the swap live on one page, and which one is the player's
     own answer rather than something the page works out: a player handed a
     raw code had nowhere to paste it before, because every route that is not
     a #j= link arrives here hosting side up. */
  it("offers both sides of the code swap and draws the one the switch picks", () => {
    const { container, net } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    press(container, "btn.otherWays");
    const sides = [...container.querySelectorAll<HTMLElement>(".swapside .kind")];
    expect(sides.map((b) => b.dataset.side)).toEqual(["host", "join"]);
    expect(sides.map((b) => b.textContent)).toEqual([
      translate(locale, "lobby.sideHost"),
      translate(locale, "lobby.sideJoin"),
    ]);

    /* Hosting: the button that builds the invitations, and nothing to paste. */
    expect(sides[0].className).toContain("on");
    expect(labelled(container, "btn.swapHost")).toHaveLength(1);
    expect(container.querySelector("#hostcode")).toBeNull();
    expect(container.querySelector(".joinas")).toBeNull();
    expect(container.textContent).toContain(translate(locale, "lobby.sideHostDek"));

    /* Joining: the box, the device switch and the click that connects — and
       picking a side connects nothing by itself. */
    fireEvent.click(sides[1]);
    expect(net.invite).not.toHaveBeenCalled();
    expect(net.join).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLElement>(".swapside .kind.on")?.dataset.side).toBe("join");
    expect(container.querySelector("#hostcode")).not.toBeNull();
    expect(container.querySelector(".joinas")).not.toBeNull();
    expect(labelled(container, "btn.swapCodes")).toHaveLength(1);
    expect(labelled(container, "btn.swapHost")).toHaveLength(0);
    expect(container.textContent).toContain(translate(locale, "lobby.sideJoinDek"));

    /* A code pasted here is a code this window can use, and the swap is what
       it is handed to. */
    fireEvent.change(container.querySelector<HTMLTextAreaElement>("#hostcode")!, {
      target: { value: CODE },
    });
    press(container, "btn.swapCodes");
    expect(net.join).toHaveBeenCalledWith(CODE, expect.stringMatching(/^(player|table)$/));
  });

  /* Hosting a code swap builds codes; it does not start a run. The run begins
     on Start, once every open chair has answered, and it is the *session* that
     dispatches it — relayed like any other flow action, so every peer creates
     the same run from the same seed. */
  it("hosts a code swap from the Other-ways page rather than starting a run", () => {
    const { container, dispatch, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
    );
    press(container, "btn.otherWays");
    press(container, "btn.swapHost");
    expect(net.invite).toHaveBeenCalledTimes(1);
    expect(net.invite).toHaveBeenCalledWith(0);
    expect(dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "newRun")).toEqual([]);

    /* Back at this level is the page it came from; the lobby's own Back is
       what leaves for the door. The page it came from is the one that opens a
       room, which is what names it now that no chair is picked on it. */
    press(container, "btn.back");
    expect(labelled(container, "btn.openRoom")).toHaveLength(1);
    expect(dispatch).not.toHaveBeenCalled();
    press(container, "btn.back");
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });

  /* Both sides of the swap return to the table, which is the page the lobby
     opens on and the one page that has a door to the swap. The side is not
     reset on the way out — it is a fact about the player, not the page. */
  it("returns from Other ways to the table, whichever side was showing", () => {
    const host = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    press(host.container, "btn.otherWays");
    expect(host.container.querySelector("#hostcode")).toBeNull();
    expect(labelled(host.container, "btn.swapHost")).toHaveLength(1);
    press(host.container, "btn.back");
    expect(labelled(host.container, "btn.openRoom")).toHaveLength(1);
    expect(host.container.querySelector(".methods")).toBeNull();
    expect(host.dispatch).not.toHaveBeenCalled();
    host.unmount();

    /* The joining side is reached by the link, and its Back is the same
       table: there is one lobby and one page that leads here. */
    const join = linkedSwap();
    expect(join.container.querySelector("#hostcode")).not.toBeNull();
    expect(labelled(join.container, "btn.swapCodes")).toHaveLength(1);
    press(join.container, "btn.back");
    expect(labelled(join.container, "btn.openRoom")).toHaveLength(1);
    expect(join.container.querySelector(".methods")).toBeNull();
    expect(join.dispatch).not.toHaveBeenCalled();
  });

  /* The join page asks one question — a room's eight characters — and offers
     the two buttons that answer it: join, or go back to the table it was
     opened from. A second route offered beside the field is a second question
     asked before the first one is answered, and leaving the lobby outright is
     the table's own Back, one step further out. */
  it("holds the room and nothing else on the join page, and goes back to the table", () => {
    const { container, dispatch } = joinPage();
    expect(container.textContent).toContain(translate(locale, "lobby.roomHint"));
    expect(container.querySelector("#roomcode")).not.toBeNull();
    expect(container.querySelector("#hostcode")).toBeNull();
    expect(container.querySelector(".lanswitch")).toBeNull();
    const foot = container.querySelector<HTMLElement>(".lobbyfoot")!;
    expect([...foot.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      translate(locale, "btn.joinRoom"),
      translate(locale, "btn.back"),
    ]);
    for (const loc of LOCALE_ORDER)
      expect([...foot.querySelectorAll("button")].map((b) => b.textContent)).not.toContain(
        translate(loc, "btn.otherWays"),
      );

    /* Back is the table, and it is component-local: nothing reaches the
       store, and the lobby is left from the page below. */
    press(container, "btn.back");
    expect(dispatch).not.toHaveBeenCalled();
    expect(labelled(container, "btn.openRoom")).toHaveLength(1);
    press(container, "btn.back");
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });

  /* ---------- the invitation ---------- */
  const CODE = packSdp("H", OFFER_SDP);
  /* The joining side of the code swap, reached the way a link reaches it: a
     #j= code in the hash lands on that page with the side already picked and
     the code already in the box. Every other route reaches the page hosting
     side up, with the switch one click away. */
  const linkedSwap = (net?: Net) => {
    const was = window.location.hash;
    window.location.hash = `#j=${CODE}`;
    const r = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, net);
    /* Read once, on the first render: the hash is never cleared in the app
       either, and a test that left it set would hand it to the next one. */
    window.location.hash = was;
    return r;
  };
  const hostingNet = (over: Partial<NetChair> = {}) =>
    stubNet({
      role: "host",
      live: true,
      seat: 0,
      chairs: OFF_CHAIRS.map((c) =>
        c.seat === 1
          ? {
              ...c,
              kind: "open",
              code: CODE,
              candidates: 3,
              complete: true,
              state: "waiting",
              ...over,
            }
          : c,
      ),
    });

  it("shows an open chair's code, its QR and a box for the answer", () => {
    const { container, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      hostingNet(),
    );
    const box = container.querySelector<HTMLTextAreaElement>(".codeblock .codebox");
    expect(box?.value).toBe(CODE);
    /* The QR carries the page with the code in its fragment, so a phone's own
       camera app opens the game with the box filled. */
    const qr = container.querySelector<SVGElement>("svg.qr");
    expect(qr).not.toBeNull();
    const span = Number(qr?.getAttribute("viewBox")?.split(" ")[2]);
    /* The symbol carries the whole join link, not the bare code — the page's
       address and "#j=" put it one version above the code alone — plus the
       four-module quiet zone on either side. */
    expect(span).toBe(
      qrMatrix(`${window.location.origin}${window.location.pathname}#j=${CODE}`).length + 8,
    );
    expect(span).toBeGreaterThan(69 + 8);
    expect(qr?.querySelectorAll("path")).toHaveLength(1);

    const answer = container.querySelector<HTMLTextAreaElement>("#ans1");
    expect(answer).not.toBeNull();
    fireEvent.change(answer!, { target: { value: "T1Gxyz" } });
    fireEvent.click(
      [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.connect"),
      )[0],
    );
    expect(net.connect).toHaveBeenCalledWith(1, "T1Gxyz");
  });

  it("starts the match only once every open chair has answered", () => {
    const label = translate(locale, "btn.startMatch");
    const start = (c: HTMLElement) =>
      [...c.querySelectorAll<HTMLButtonElement>("button")].filter(
        (b) => b.textContent === label,
      )[0];

    const waiting = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      hostingNet(),
    );
    expect(start(waiting.container).disabled).toBe(true);
    expect(waiting.container.textContent).toContain(translate(locale, "lobby.needAll"));
    waiting.unmount();

    /* On a match mode, because a connected chair is exactly the state in
       which the roguelike is refused: this case is about the chairs. */
    const here = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, {
      ...hostingNet({ state: "connected" }),
      match: "race",
    });
    expect(start(here.container).disabled).toBe(false);
    fireEvent.click(start(here.container));
    expect(here.net.start).toHaveBeenCalled();
  });

  /* A chair whose invitation was answered by a shared display is settled: the
     device is here, it holds no chair, and the game plays that one. Waiting
     for it to become "connected" would leave Start disabled for ever. */
  it("starts with a chair the shared table answered, and says the game has it", () => {
    const { container, net } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, {
      ...hostingNet({ state: "table" }),
      match: "race",
    });
    expect(container.textContent).toContain(translate(locale, "lobby.chairTable"));
    expect(container.textContent).toContain(translate(locale, "lobby.allHere"));
    const start = [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => b.textContent === translate(locale, "btn.startMatch"),
    )[0];
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    expect(net.start).toHaveBeenCalled();
  });

  /* And it stops offering the invitation, exactly as a chair a player took
     does. The device on that link is here: its code is spent, and a Connect
     button beside it would hand a second answer to a stable connection, which
     the browser rejects with nothing for the host to do about it. */
  it.each([
    ["connected", "lobby.chairConnected"],
    ["table", "lobby.chairTable"],
  ] as const)("draws no live invitation for a chair that has been answered (%s)", (state, said) => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      hostingNet({ state }),
    );
    const block = [...container.querySelectorAll<HTMLElement>(".netchair")].filter((b) =>
      b.textContent?.includes(translate(locale, said)),
    )[0];
    expect(block).not.toBeUndefined();
    /* Settled reads as settled, visually as well as in words. */
    expect(block.classList.contains("on")).toBe(true);
    expect(block.querySelector(".codeblock")).toBeNull();
    expect(block.querySelector("svg.qr")).toBeNull();
    expect(block.querySelector("#ans1")).toBeNull();
    expect(block.textContent).not.toContain(translate(locale, "lobby.theirCode"));
    expect(
      [...block.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent),
    ).not.toContain(translate(locale, "btn.connect"));
  });

  /* The display's invitation is built for every code-swap host, so an
     unanswered one says nothing about whether a screen is expected — gating
     Start on it would leave every such host with a button that never enables.
     Connected before Start is still the display's one precondition, and
     lobby.tableDek in its own block is what says so. */
  it.each([
    ["waiting", "lobby.alone", "lobby.allHere"],
    ["connected", "lobby.allHere", "lobby.alone"],
    ["failed", "lobby.alone", "lobby.allHere"],
  ] as const)(
    "starts whatever the shared table's own invitation says (%s)",
    (state, said, notSaid) => {
      const { container } = renderWith(
        loadedState({ menu: "lobby" }),
        <Screens />,
        locale,
        0,
        stubNet({
          role: "host",
          live: true,
          seat: 0,
          /* A match mode, since a display that is in refuses the roguelike —
             this case is about the display's invitation, not the mode. */
          match: "race",
          tableInvite: { code: CODE, candidates: 3, complete: true, state },
        }),
      );
      const start = labelled(container, "btn.startMatch")[0];
      expect(start.disabled).toBe(false);
      /* The chairs are what Start is keyed on, and there are none open here.
         The sentence above it is a different question: only "connected" means
         a device actually answered, so that is the one state of the three in
         which "Everyone is here." is true — the other two are a host alone
         with a code nobody took. What does not move is the enablement asserted
         above, or the button's own label. */
      expect(container.textContent).toContain(translate(locale, said));
      expect(container.textContent).not.toContain(translate(locale, notSaid));
    },
  );

  /* One invitation more, belonging to no chair. Its own block, because it is
     not a seat at the table and reading it as one is the whole confusion this
     mode has to avoid. */
  it("draws the shared table's own invitation beside the chairs", () => {
    const { container, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      stubNet({
        role: "host",
        live: true,
        seat: 0,
        tableInvite: { code: CODE, candidates: 3, complete: true, state: "waiting" },
      }),
    );
    const block = [...container.querySelectorAll<HTMLElement>(".netchair")].filter((b) =>
      b.textContent?.includes(translate(locale, "lobby.tableChair")),
    )[0];
    expect(block).not.toBeUndefined();
    expect(block.querySelector<HTMLTextAreaElement>(".codeblock .codebox")?.value).toBe(CODE);
    expect(block.querySelector("svg.qr")).not.toBeNull();
    expect(block.textContent).toContain(translate(locale, "lobby.inviteReady"));
    /* Whose code it is, and the precondition Start no longer enforces. It is
       in this block and not in the page's summary, because the summary is
       keyed on the chairs. */
    expect(block.textContent).toContain(translate(locale, "lobby.tableDek"));

    fireEvent.change(block.querySelector<HTMLTextAreaElement>("#anstable")!, {
      target: { value: "T1Gxyz" },
    });
    fireEvent.click(
      [...block.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.connect"),
      )[0],
    );
    expect(net.connect).toHaveBeenCalledWith("table", "T1Gxyz");
    check("the host's shared-table block", locale, container.textContent ?? "");
  });

  /* Hang up came back with the door it lived behind: the lobby is the only
     view between the start menu and a session now, so every session page's
     footer carries it. Back is beside it, because leaving the screen and
     leaving the session are two different things — a host who has not
     connected everybody wants the first. */
  it.each([
    ["the host's table", "lobby", () => hostingNet()],
    ["a host in a room", "lobby", () => inRoom()],
    ["a seated guest", "lobby", () => stubNet({ role: "guest", live: true, seat: 2 })],
    ["a shared table", "lobby", () => stubNet({ role: "table", live: true, room: ROOM })],
  ] as const)("hangs up and leaves %s by two separate buttons", (_label, menu, net) => {
    const {
      container,
      dispatch,
      net: session,
    } = renderWith(loadedState({ menu }), <Screens />, locale, 0, net());
    const at = (key: LocaleKey) =>
      [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, key),
      );
    expect(at("btn.hangUp")).toHaveLength(1);
    fireEvent.click(at("btn.hangUp")[0]);
    expect(session.hangUp).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();

    expect(at("btn.back")).toHaveLength(1);
    fireEvent.click(at("btn.back")[0]);
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });

  /* The way back onto the game already behind the menu moved off the start
     menu and into the lobby's own footer, drawn immediately before Hang up —
     the same four stubs the hang-up case above uses, so the order is pinned
     for the host's two pages and the guest/table's shared one. runStarted is
     forced on and challenge left null, so the label is lobby.returnGame
     throughout. */
  it.each([
    ["the host's table", () => hostingNet(), ["btn.startMatch"]],
    ["a host in a room", () => inRoom(), ["btn.startAlone"]],
    ["a seated guest", () => stubNet({ role: "guest", live: true, seat: 2 }), []],
    ["a shared table", () => stubNet({ role: "table", live: true, room: ROOM }), []],
  ] as const)(
    "draws exactly one return, before Hang up, in %s's lobby footer",
    (_label, net, startKeys) => {
      const { container } = renderWith(
        loadedState({ menu: "lobby", runStarted: true }),
        <Screens />,
        locale,
        0,
        net(),
      );
      const foot = container.querySelector(".lobbyfoot")!;
      const labels = [...foot.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
      expect(labels).toEqual([
        ...startKeys.map((k) => translate(locale, k)),
        translate(locale, "lobby.returnGame"),
        translate(locale, "btn.hangUp"),
        translate(locale, "btn.back"),
      ]);
    },
  );

  /* The label reads g.challenge, never the session — an open room with no
     match started still has the solo run behind it. Moved here from
     Menu.test.tsx now that the button itself moved. */
  it.each(["rummikub", "race", "tuppi"] as const)("returns to %s from the lobby", (id) => {
    const solo = loadedState({ menu: "lobby", runStarted: true });
    const g = {
      ...gameReducer(solo, { type: "startChallenge", id, seed: "CHALLENGE" }),
      menu: "lobby" as const,
    };
    const { container, dispatch } = renderWith(g, <Screens />, locale, 0, hostingNet());
    const key = id === "rummikub" ? "lobby.returnChallenge" : "lobby.returnMatch";
    press(container, key);
    expect(dispatch.mock.calls).toEqual([[{ type: "closeMenu" }]]);
    expect(gameReducer(g, dispatch.mock.calls[0][0])).toEqual({ ...g, menu: null });
  });

  it("calls a shared roguelike a game rather than a match", () => {
    const g: GameState = {
      ...loadedState({ menu: "lobby", runStarted: true }),
      seats: ["human", "human", "ai", "ai"],
    };
    const { container } = renderWith(g, <Screens />, locale, 0, hostingNet());
    expect(labelled(container, "lobby.returnMatch")).toHaveLength(0);
    expect(labelled(container, "lobby.returnGame")).toHaveLength(1);
  });

  /* Two clicks from the start menu back onto the felt, and neither Hang up
     nor Start is touched on the way — opening the menu and closing it again
     is not leaving the session. */
  it.each([
    ["a host in a room", () => inRoom()],
    ["a host on the code swap", () => hostingNet()],
    ["a seated guest", () => stubNet({ role: "guest", live: true, seat: 2 })],
    ["a shared table", () => stubNet({ role: "table", live: true, room: ROOM })],
  ] as const)("gets back into the match from %s in two clicks", (_label, net) => {
    const g = loadedState({ menu: "start", runStarted: true });
    const session = net();
    const menu = renderWith(g, <Screens />, locale, 0, session);
    const first = labelled(menu.container, "btn.multiplayer");
    if (session.role === "table") {
      /* A table draws no Multiplayer button; its menu is unreachable by any
         numbered action, and this case is here only to complete the sweep. */
      expect(first).toHaveLength(0);
      menu.unmount();
      return;
    }
    fireEvent.click(first[0]);
    expect(menu.dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "lobby" }]]);
    const lobby = gameReducer(g, menu.dispatch.mock.calls[0][0]);
    menu.unmount();

    const view = renderWith(lobby, <Screens />, locale, 0, session);
    press(view.container, "lobby.returnGame");
    expect(view.dispatch.mock.calls).toEqual([[{ type: "closeMenu" }]]);
    expect(view.net.hangUp).not.toHaveBeenCalled();
    expect(view.net.start).not.toHaveBeenCalled();
  });

  /* Both halves of the gate bind: no run started means nothing to return to,
     even in a live session. */
  it("draws no return with runStarted false, in any of the three live footers", () => {
    for (const net of [
      hostingNet(),
      inRoom(),
      stubNet({ role: "guest", live: true, seat: 2 }),
      stubNet({ role: "table", live: true, room: ROOM }),
    ]) {
      const { container, unmount } = renderWith(
        loadedState({ menu: "lobby", runStarted: false }),
        <Screens />,
        locale,
        0,
        net,
      );
      const labels = [...container.querySelectorAll<HTMLElement>("button")].map(
        (b) => b.textContent,
      );
      for (const loc of LOCALE_ORDER) {
        expect(labels).not.toContain(translate(loc, "lobby.returnChallenge"));
        expect(labels).not.toContain(translate(loc, "lobby.returnMatch"));
        expect(labels).not.toContain(translate(loc, "lobby.returnGame"));
      }
      unmount();
    }
  });

  /* And offline there is nothing to hang up, so the button is not drawn at
     all rather than offering a dead click. */
  it.each(["table", "room"] as const)("draws no Hang up on the offline %s page", (page) => {
    const { container } =
      page === "table"
        ? renderWith(loadedState({ menu: "lobby" }), <Screens />, locale)
        : joinPage();
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    for (const loc of LOCALE_ORDER) expect(labels).not.toContain(translate(loc, "btn.hangUp"));
  });

  /* Offline there is no session to return into either — on the offline chair
     table, the join page, and Other ways to connect one level down from each,
     which is where net.live is false without net.role ever reading "off" on
     the page itself (the chair table and the join page do read "off", but
     Other ways to connect reads it exactly the same way, which is the case
     the net.live clause guards even though it is redundant on every page
     today). */
  it.each(["table", "room"] as const)("draws no return on the offline %s page", (page) => {
    const { container } =
      page === "table"
        ? renderWith(loadedState({ menu: "lobby", runStarted: true }), <Screens />, locale)
        : joinPage({ runStarted: true });
    const sweep = () => {
      const labels = [...container.querySelectorAll<HTMLElement>("button")].map(
        (b) => b.textContent,
      );
      for (const loc of LOCALE_ORDER) {
        expect(labels).not.toContain(translate(loc, "lobby.returnChallenge"));
        expect(labels).not.toContain(translate(loc, "lobby.returnMatch"));
        expect(labels).not.toContain(translate(loc, "lobby.returnGame"));
      }
    };
    sweep();
    /* The table reaches one more page; the join page reaches none — its two
       buttons are the room and the way back. */
    if (page === "table") {
      press(container, "btn.otherWays");
      sweep();
    }
  });

  /* The waiting page belongs to the role, not to the view: a stub that says
     "guest" draws it over whichever page the lobby is on. */
  it("shows a guest its own answer to hand back", () => {
    const answer = packSdp("G", ANSWER_SDP);
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      stubNet({ role: "guest", live: true, seat: 2, answer }),
    );
    expect(container.querySelector<HTMLTextAreaElement>(".codebox")?.value).toBe(answer);
    expect(container.querySelector("svg.qr")).not.toBeNull();
    /* The chair reads as its character, not as "You": a guest told "Your
       chair: You" has been told nothing. */
    expect(container.textContent).toContain(
      translate(locale, "lobby.seated", { who: SEATS[2].name }),
    );
  });

  /* A table's seat is null exactly as an unwelcomed guest's is, so the role is
     what tells the two apart — without that branch a shared display would sit
     on "waiting for the host" for the whole match. */
  it.each([
    ["waiting for the welcome", null, "lobby.tableWaiting"],
    ["welcomed with no chair", "live", "lobby.tableSeated"],
  ] as const)("tells a shared table it is one, %s", (_label, status, key) => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      stubNet({ role: "table", live: true, seat: null, status, answer: packSdp("G", ANSWER_SDP) }),
    );
    expect(container.textContent).toContain(translate(locale, key));
    /* Welcomed, it must stop saying it is waiting — that is the hole this
       branch fills, since a table's seat stays null either way. The waiting
       line itself reads the same as a player's, deliberately: it is the same
       moment. */
    if (status === "live")
      expect(container.textContent).not.toContain(translate(locale, "lobby.waitingHost"));
    /* No chair is claimed, so no character is named. */
    for (const s of SEATS) expect(container.textContent).not.toContain(s.name);
  });

  /* Both of these belong to the code swap, so both are one level down behind
     Other ways to connect: the refusal is about a pasted code, and the room
     never asks for one. */
  it("says why a pasted code was refused", () => {
    const { container } = linkedSwap(stubNet({ problem: "kind" }));
    expect(container.querySelector(".warn")?.textContent).toBe(translate(locale, "net.bad.kind"));
  });

  /* The joining device says which of the two things it is before it connects:
     the host cannot tell a phone from a television, and a table seated as a
     player is a chair the match would wait on for ever. */
  const joinView = (width: number) => {
    vi.stubGlobal("innerWidth", width);
    /* On the swap's own page, which the link lands on: the room hands its
       chairs out from the host's roster and cannot seat a display, so the
       choice matters most on the route whose invitation reserves nothing. */
    const r = linkedSwap();
    const asBtn = (as: string) => r.container.querySelector<HTMLElement>(`.kind[data-as="${as}"]`)!;
    const join = (code: string) => {
      fireEvent.change(r.container.querySelector<HTMLTextAreaElement>("#hostcode")!, {
        target: { value: code },
      });
      fireEvent.click(
        [...r.container.querySelectorAll<HTMLElement>("button")].filter(
          (b) => b.textContent === translate(locale, "btn.swapCodes"),
        )[0],
      );
    };
    return {
      ...r,
      asBtn,
      join,
      /* Scoped to the device switch: the swap's own side picker is drawn
         above it and shares the .kind shape. */
      chosen: () => r.container.querySelector(".joinas .kind.on")?.textContent,
    };
  };

  it("joins with the code in the box, as whichever thing the device is", () => {
    const w = joinView(390);
    w.join(CODE);
    expect(w.net.join).toHaveBeenCalledWith(CODE, "player");
  });

  /* A plain width read on the first render, not a media query and not a device
     class: 900 puts a landscape phone under it and a tablet or a laptop over
     it. It is a suggestion, which is why both cases below then click the other
     one. */
  it.each([
    [390, "lobby.asPlayer", "player"],
    [1280, "lobby.asTable", "table"],
    /* The boundary itself, which a `>` would put on the wrong side. */
    [900, "lobby.asTable", "table"],
  ] as const)("preselects the right answer at %ipx", (width, label, as) => {
    const w = joinView(width);
    expect(w.chosen()).toBe(translate(locale, label));
    expect(w.asBtn(as).className).toContain("on");
  });

  it.each([
    [390, "table"],
    [1280, "player"],
  ] as const)("joins as the other answer when it is clicked at %ipx", (width, other) => {
    const w = joinView(width);
    fireEvent.click(w.asBtn(other));
    expect(w.chosen()).toBe(
      translate(locale, other === "table" ? "lobby.asTable" : "lobby.asPlayer"),
    );
    w.join(CODE);
    expect(w.net.join).toHaveBeenCalledWith(CODE, other);
  });

  /* A table is reachable only inside a live session: with no session there is
     no peer to advance the player-gated phases, and the board would stall on
     the first one. So no menu button and no lobby control short of the join
     view's own Join may set the role — and the only thing that could is
     net.join, which is what this walks the two views looking for. */
  it("reaches no offline route into the shared table", () => {
    for (const menu of ["start", "lobby"] as const) {
      const { container, net, unmount } = renderWith(
        loadedState({ menu, runStarted: true }),
        <Screens />,
        locale,
      );
      for (const b of [...container.querySelectorAll<HTMLElement>("button")]) fireEvent.click(b);
      expect(net.join, `${menu} reached net.join`).not.toHaveBeenCalled();
      unmount();
    }
  });

  /* A #j= link carries a code only the swap can use, so it wins over the door
     it was opened behind: the page it lands on is the swap's, on the joining
     side, with the box already filled. */
  it("opens the code swap with the linked code, whichever page the lobby would open on", () => {
    {
      const was = window.location.hash;
      window.location.hash = `#j=${CODE}`;
      try {
        const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
        expect(container.querySelector(".methods")).not.toBeNull();
        expect(container.textContent).toContain(translate(locale, "lobby.swapTitle"));
        expect(container.querySelector<HTMLTextAreaElement>("#hostcode")?.value).toBe(CODE);
        expect(labelled(container, "btn.swapCodes")).toHaveLength(1);
      } finally {
        window.location.hash = was;
      }
    }
  });

  /* The hash is never cleared and survives a reload, so what the link decides
     has to stop deciding once the player has said otherwise. It seeds the
     side and the switch owns it from there — leaving the page resets nothing,
     because the answer is about the player and not about the page, and the
     switch is the way back to hosting that a window opened from somebody's QR
     used to need a page exit for. */
  it("keeps the side the link picked until the switch changes it", () => {
    const was = window.location.hash;
    window.location.hash = `#j=${CODE}`;
    try {
      const { container, dispatch } = renderWith(
        loadedState({ menu: "lobby" }),
        <Screens />,
        locale,
      );
      expect(container.querySelector<HTMLTextAreaElement>("#hostcode")?.value).toBe(CODE);

      /* Out to the table and back in: the same side, the same code. */
      press(container, "btn.back");
      expect(labelled(container, "btn.openRoom")).toHaveLength(1);
      press(container, "btn.otherWays");
      expect(labelled(container, "btn.swapCodes")).toHaveLength(1);
      expect(container.querySelector<HTMLTextAreaElement>("#hostcode")?.value).toBe(CODE);

      /* And the switch is what changes it — with the code still in the hash,
         which is exactly the window that used to be stuck. */
      fireEvent.click(container.querySelector<HTMLElement>('.kind[data-side="host"]')!);
      expect(labelled(container, "btn.swapHost")).toHaveLength(1);
      expect(container.querySelector("#hostcode")).toBeNull();
      press(container, "btn.back");
      press(container, "btn.otherWays");
      expect(labelled(container, "btn.swapHost")).toHaveLength(1);
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      window.location.hash = was;
    }
  });

  /* ---------- the room ---------- */
  const ROOM = "ABCD1234";
  const inRoom = (over: Partial<NetChair> = {}) => ({ ...hostingNet(over), room: ROOM });

  it("opens a room from the table", () => {
    const { container, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      2,
      stubNet({ name: "Host" }),
    );
    /* Open a room navigates from the landing page now, so the real call is
       one step further in, on the host-setup page it opens. */
    press(container, "btn.openRoom");
    press(container, "btn.openRoom");
    expect(net.openRoom).toHaveBeenCalledWith();
    expect(net.invite).not.toHaveBeenCalled();
  });

  /* One code for the whole table, so a chair on that route carries nothing to
     move: no code of its own, no QR, and no box for an answer. */
  it("shows the room's one code and no per-chair invitation", () => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      inRoom(),
    );
    expect(container.querySelector(".roomchars")?.textContent).toBe(ROOM);
    expect(container.querySelector(".codeblock")).toBeNull();
    expect(container.querySelector("svg.qr")).toBeNull();
    expect(container.querySelector("#ans1")).toBeNull();
    expect(container.textContent).toContain(translate(locale, "lobby.needAssignments"));
  });

  /* The room is the way people will actually join, so it is the way a shared
     display joins too: the same code box, and the same question about what
     the device is asked before the same click. */
  it.each([
    [390, "player"],
    [1280, "table"],
  ] as const)("joins a room with the typed code, as the device at %ipx", (width, as) => {
    vi.stubGlobal("innerWidth", width);
    const joiningNet = stubNet({ name: as === "player" ? "Guest" : "" });
    const { container, net } = joinPage({}, joiningNet);
    expect(container.querySelector(".joinas")).not.toBeNull();
    const box = container.querySelector<HTMLInputElement>("#roomcode");
    fireEvent.change(box!, { target: { value: "abcd1234" } });
    fireEvent.click(
      [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.joinRoom"),
      )[0],
    );
    /* Typed as it was read out; normalising it is the session's job, because
       the same string is the room's name and its password. */
    expect(net.enterRoom).toHaveBeenCalledWith("abcd1234", as);
  });

  /* The answer follows the device between the two routes: one piece of
     component state, drawn by both pages, so a player who walks from one to
     the other does not have to say what their screen is twice. The walk is
     the swap's page to the room's now — the link is what lands a guest on the
     swap, and the room's own page offers no door back to it. */
  it("carries the chosen role from the code swap to the room's page", () => {
    vi.stubGlobal("innerWidth", 390);
    const { container, net } = linkedSwap();
    fireEvent.click(container.querySelector<HTMLElement>('.kind[data-as="table"]')!);
    press(container, "btn.back");
    press(container, "btn.joinGame");
    /* The room's page, with the answer the swap's page was given already on
       it — and a display needs no name, so its Join is live. */
    expect(container.querySelector("#roomcode")).not.toBeNull();
    expect(container.querySelector<HTMLElement>(".joinas .kind.on")?.dataset.as).toBe("table");
    fireEvent.change(container.querySelector<HTMLInputElement>("#roomcode")!, {
      target: { value: "abcd1234" },
    });
    press(container, "btn.joinRoom");
    expect(net.enterRoom).toHaveBeenCalledWith("abcd1234", "table");
  });

  /* Neither route has a timeout — useGameLoop is the only timer — so a room
     nobody answers is silent, and silence is also what a host who has not
     started yet looks like. The way out is therefore offered for the whole
     wait, and it hangs up, because the session is live from the moment the
     room is opened or entered. */
  it("offers a way out of a room nobody has answered, and hangs up rather than dispatching", () => {
    const { container, dispatch, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      inRoom(),
    );
    const esc = container.querySelector<HTMLElement>(".netescape");
    expect(esc?.textContent).toContain(translate(locale, "lobby.roomTrouble"));
    /* Untouched by the footer's demotion: the escape hatch is the only
       offered action on this page, so it stays the smaller button variant
       rather than becoming the same text link. */
    expect(esc?.querySelector("button")?.className).toBe("btn small ghost");
    fireEvent.click(
      [...esc!.querySelectorAll<HTMLButtonElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.otherWays"),
      )[0],
    );
    /* Leaving a room is the session's business and nothing to do with the
       store: exactly one hang-up, and no action at all. */
    expect(net.hangUp).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  /* Where that click lands, which a stub alone cannot show: stubNet\'s hangUp
     is a mock, so the role stays "host" and the room page goes on rendering.
     This provider does what useNetGame\'s hangUp does — sets the role to
     "off" — and that is what leaves the window on the Other-ways page for its
     own side. */
  function AfterHangUp({ from, children }: { from: Net; children: ReactNode }) {
    const [live, setLive] = useState(true);
    const net = live ? from : stubNet();
    return (
      <NetContext.Provider
        value={{
          ...net,
          hangUp: () => {
            from.hangUp();
            setLive(false);
          },
        }}
      >
        {children}
      </NetContext.Provider>
    );
  }

  /* The escape lands on the swap's own page, hosting side, whichever window
     took it: the side is the player's answer now and the switch is where it
     is given, so a guest whose room answered nobody says so in one more click
     rather than being guessed at. */
  it.each([
    ["hosting", () => inRoom()],
    ["joining", () => stubNet({ role: "guest", live: true, seat: null, room: ROOM })],
  ] as const)("leaves a room on the Other-ways page, %s", (_label, stub) => {
    const from = stub();
    const { container, dispatch } = renderWith(
      loadedState({ menu: "lobby" }),
      <AfterHangUp from={from}>
        <Screens />
      </AfterHangUp>,
      locale,
    );
    press(container.querySelector<HTMLElement>(".netescape")!, "btn.otherWays");
    expect(from.hangUp).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
    expect(container.querySelector(".methods")).not.toBeNull();
    expect(labelled(container, "btn.swapHost")).toHaveLength(1);
    expect(container.querySelector(".netescape")).toBeNull();
    /* And the paste box is one click away, for the guest who has a code. */
    fireEvent.click(container.querySelector<HTMLElement>('.kind[data-side="join"]')!);
    expect(labelled(container, "btn.swapCodes")).toHaveLength(1);
    expect(container.querySelector("#hostcode")).not.toBeNull();
  });

  /* Shown while the table is not full, and gone the moment it is: an escape
     from a room that has everybody in it is an escape from nothing. Off the
     code swap's own pages too, where there is no room to leave. */
  it.each([
    ["a host whose room nobody has answered", "lobby", () => inRoom(), true],
    ["a host whose room is full", "lobby", () => inRoom({ state: "connected" }), true],
    [
      "a guest with no chair yet",
      "lobby",
      () => stubNet({ role: "guest", live: true, seat: null, room: ROOM }),
      true,
    ],
    [
      "a seated guest",
      "lobby",
      () => stubNet({ role: "guest", live: true, seat: 2, room: ROOM }),
      false,
    ],
    /* Chair occupancy no longer controls admission: the host can leave the
       waiting room until Start, even before assigning itself. */
    [
      "a host whose room has no open chair",
      "lobby",
      () => ({ ...stubNet({ role: "host", live: true, seat: 0 }), room: ROOM }),
      true,
    ],
    ["a host on the code swap", "lobby", () => hostingNet(), false],
    [
      "a guest on the code swap",
      "lobby",
      () => stubNet({ role: "guest", live: true, seat: null, answer: CODE }),
      false,
    ],
  ] as const)("shows the room's way out to %s: %s", (_label, menu, net, shown) => {
    const { container } = renderWith(loadedState({ menu }), <Screens />, locale, 0, net());
    expect(container.querySelector(".netescape") !== null).toBe(shown);
  });

  it("lets the host assign connected room players to chairs", () => {
    const host = { id: "host", name: "Host", seat: 0 as Seat };
    const guest = { id: "g1", name: "Guest", seat: null };
    const net = stubNet({
      role: "host",
      live: true,
      room: ROOM,
      seat: 0,
      players: [host, guest],
      canStart: false,
    });
    const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, net);
    expect(container.textContent).toContain(translate(locale, "lobby.players"));
    expect(container.textContent).toContain(translate(locale, "lobby.unassigned"));
    expect(container.textContent).toContain(translate(locale, "lobby.needAssignments"));
    const chair = container.querySelectorAll<HTMLSelectElement>("select")[2];
    fireEvent.change(chair, { target: { value: "g1" } });
    expect(net.assignPlayer).toHaveBeenCalledWith("g1", 2);
    expect(labelled(container, "btn.startMatch")[0]).toBeDisabled();
  });

  /* ---------- who is actually in the room ---------- */
  /* openLobby puts the host itself in `players` under ROOM_HOST_ID, so the
     roster is a list of one in a room nobody has answered and net.canStart —
     which answers seating and nothing else — is satisfied the moment the host
     picks its own chair. A match mode, because a room with company refuses
     the roguelike and that is a different question. */
  const HOST_ROW = { id: "host", name: "Host", seat: 0 as Seat };
  const guestRow = (i: number, seat: Seat | null) => ({
    id: `g${i}`,
    name: `Guest ${i}`,
    seat,
  });
  const roomHost = (over: Partial<Net>) =>
    stubNet({ role: "host", live: true, room: ROOM, seat: 0, match: "race", ...over });

  it("never reads a room of one as everyone, and says what starting alone costs", () => {
    const { container, net } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({ players: [HOST_ROW], canStart: true }),
    );
    expect(container.textContent).not.toContain(translate(locale, "lobby.allHere"));
    expect(container.textContent).toContain(translate(locale, "lobby.alone"));
    expect(container.textContent).toContain(
      translate(locale, "lobby.othersHere", { n: formatNumber(locale, 0) }),
    );
    /* The capability is preserved, not removed: the label is what changes. */
    const start = labelled(container, "btn.startAlone");
    expect(start).toHaveLength(1);
    expect(start[0].disabled).toBe(false);
    expect(labelled(container, "btn.startMatch")).toHaveLength(0);
    fireEvent.click(start[0]);
    expect(net.start).toHaveBeenCalledTimes(1);
  });

  it.each([1, 3] as const)("counts the other people in the room: %i", (n) => {
    const players = [
      HOST_ROW,
      ...Array.from({ length: n }, (_, i) => guestRow(i + 1, (i + 1) as Seat)),
    ];
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({ players, canStart: true }),
    );
    expect(container.textContent).toContain(
      translate(locale, "lobby.othersHere", { n: formatNumber(locale, n) }),
    );
    /* With somebody else seated the old sentence is true again, and the
       button says the ordinary thing. */
    expect(container.textContent).toContain(translate(locale, "lobby.allHere"));
    expect(container.textContent).not.toContain(translate(locale, "lobby.alone"));
    expect(labelled(container, "btn.startMatch")[0].disabled).toBe(false);
    expect(labelled(container, "btn.startAlone")).toHaveLength(0);
  });

  /* The label reads the company, not the seating gate: a connected guest with
     no chair yet is a room the host is not alone in, so Start still says it
     starts a match — and is still disabled, because canStart is what decides
     that and it gained no clause. */
  it("keeps the ordinary Start label, disabled, while a connected player waits for a chair", () => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({ players: [HOST_ROW, guestRow(1, null)], canStart: false }),
    );
    expect(container.textContent).toContain(
      translate(locale, "lobby.othersHere", { n: formatNumber(locale, 1) }),
    );
    expect(container.textContent).toContain(translate(locale, "lobby.needAssignments"));
    expect(container.textContent).not.toContain(translate(locale, "lobby.alone"));
    expect(container.textContent).not.toContain(translate(locale, "lobby.allHere"));
    expect(labelled(container, "btn.startAlone")).toHaveLength(0);
    expect(labelled(container, "btn.startMatch")[0]).toBeDisabled();
  });

  /* A welcomed display is not company: it holds no chair, plays nothing and
     has its own line. The room's number counts players, so a host with a
     screen on the wall and nobody else is still alone. */
  it("does not count a welcomed shared display as another player in the room", () => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({
        players: [HOST_ROW],
        canStart: true,
        tableHere: true,
      }),
    );
    expect(container.textContent).toContain(translate(locale, "lobby.tableJoined"));
    expect(container.textContent).not.toContain(translate(locale, "lobby.tableSeated"));
    expect(container.textContent).toContain(
      translate(locale, "lobby.othersHere", { n: formatNumber(locale, 0) }),
    );
    expect(container.textContent).toContain(translate(locale, "lobby.alone"));
    expect(container.textContent).not.toContain(translate(locale, "lobby.allHere"));
    expect(labelled(container, "btn.startAlone")).toHaveLength(1);
  });

  /* The line and the roster row both read net.tableHere, the flag onTables
     sets and lowers, and neither reads net.tableInvite any more: that field
     is the code swap's own invitation and its answer state, and a room never
     writes it. This is the positive half. */
  it("draws the shared-display line and roster row from the live tableHere flag", () => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({ players: [HOST_ROW], canStart: true, tableHere: true, tableInvite: null }),
    );
    expect(container.textContent).toContain(translate(locale, "lobby.tableJoined"));
    expect(container.querySelectorAll(".seatpick.tablerow")).toHaveLength(1);
    check("the room host page with a display present", locale, container.textContent ?? "");
  });

  /* The negative case is the point of this spec: a stale tableInvite that was
     never lowered must not go on saying a display is here once the live flag
     says otherwise. A page that still reads tableInvite fails here. */
  it("draws neither the line nor the roster row from a stale tableInvite", () => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({
        players: [HOST_ROW],
        canStart: true,
        tableHere: false,
        tableInvite: { code: null, candidates: 0, complete: true, state: "connected" },
      }),
    );
    expect(container.textContent).not.toContain(translate(locale, "lobby.tableJoined"));
    expect(container.querySelectorAll(".seatpick.tablerow")).toHaveLength(0);
  });

  /* net.players.length still decides the rest of the roster: the display's
     row sits beside it, never inside net.players.map, so the set of player
     rows is identical whether or not the display is here. */
  it("draws the same player rows whether or not the display is here, plus its own row", () => {
    const players = [HOST_ROW, guestRow(1, 1)];
    const without = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({ players, canStart: true, tableHere: false }),
    );
    const withTable = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({ players, canStart: true, tableHere: true }),
    );
    /* Two .seatpicks lists: the roster (players.length, plus the table row)
       and the chair-assignment list (always four). */
    const rosterRows = (container: HTMLElement) =>
      container.querySelectorAll<HTMLElement>(".seatpicks")[0].querySelectorAll(".seatpick");
    expect(rosterRows(without.container)).toHaveLength(players.length);
    expect(rosterRows(withTable.container)).toHaveLength(players.length + 1);
    expect(withTable.container.querySelectorAll(".seatpick.tablerow")).toHaveLength(1);
    without.unmount();
    withTable.unmount();
  });

  /* The switch belongs to the code swap: a room's signalling crosses a public
     relay whatever it is set to, so on a room's page the label would promise
     privacy it cannot give. */
  it("carries the LAN switch on the code-swap pages only", () => {
    const table = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    expect(table.container.querySelector(".lanswitch")).toBeNull();
    press(table.container, "btn.otherWays");
    expect(table.container.querySelector(".lanswitch")).not.toBeNull();
    table.unmount();

    const room = joinPage();
    expect(room.container.querySelector(".lanswitch")).toBeNull();
    room.unmount();

    const join = linkedSwap();
    expect(join.container.querySelector(".lanswitch")).not.toBeNull();
    join.unmount();

    for (const net of [
      () => inRoom(),
      () => stubNet({ role: "guest", live: true, seat: 2, room: ROOM }),
    ]) {
      const room = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, net());
      expect(room.container.querySelector(".lanswitch")).toBeNull();
      room.unmount();
    }
  });

  it("shows a guest in a room the code it joined, and no answer to carry", () => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      2,
      stubNet({ role: "guest", live: true, seat: 2, room: ROOM }),
    );
    expect(container.querySelector(".roomchars")?.textContent).toBe(ROOM);
    expect(container.querySelector(".codeblock")).toBeNull();
    expect(container.textContent).toContain(translate(locale, "lobby.roomWait"));
  });

  /* ---------- the connection explanation moved off the first page ---------- */
  /* The first page states a name and a mode, never how the wire works: that
     prose belongs to a page where a session exists, and the table before one
     does is not one. */
  it("draws nothing about the connection on the lobby's first page", () => {
    const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
    const text = container.textContent ?? "";
    for (const loc of LOCALE_ORDER)
      for (const key of ["lobby.readable", "lobby.roomRelay"] as const)
        expect(text).not.toContain(translate(loc, key));
  });

  /* Once a room exists the host reads both lines exactly once, below the
     roster and the mode picker: the readiness lines, the roster and the
     chair assignment are what the click needs, so 2026-09-13's ordering —
     readiness first — is preserved by drawing the explanation under it
     rather than above it. */
  it("explains the connection on the host's room page, below the roster and the mode heading", () => {
    const { container } = renderWith(
      loadedState({ menu: "lobby" }),
      <Screens />,
      locale,
      0,
      roomHost({ players: [HOST_ROW, guestRow(1, 1)], canStart: true }),
    );
    const text = container.textContent ?? "";
    const readable = translate(locale, "lobby.readable");
    const roomRelay = translate(locale, "lobby.roomRelay");
    expect(text.split(readable)).toHaveLength(2);
    expect(text.split(roomRelay)).toHaveLength(2);
    const readableAt = text.indexOf(readable);
    /* indexOf answers -1 for a needle that is not there, so an anchor that
       stopped being drawn would satisfy every comparison below while the
       ordering they check had quietly stopped existing. Each anchor is
       asserted present first, and the comparison then means something. */
    for (const anchor of [
      translate(locale, "lobby.othersHere", { n: formatNumber(locale, 1) }),
      translate(locale, "lobby.assignSeat"),
      translate(locale, "lobby.mode"),
    ]) {
      const at = text.lastIndexOf(anchor);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(readableAt).toBeGreaterThan(at);
    }
  });

  /* The guest and the shared table read both lines too, once each, after the
     status line this window needs to read first and ahead of the footer —
     the same "most important content first" rule the host's own pages
     follow. */
  it.each([
    [
      "a seated guest",
      () => stubNet({ role: "guest", live: true, seat: 1, room: ROOM }),
      () => translate(locale, "lobby.seated", { who: SEATS[1].name }),
    ],
    [
      "an unseated guest",
      () => stubNet({ role: "guest", live: true, seat: null, room: ROOM }),
      () => translate(locale, "lobby.waitingHost"),
    ],
    [
      "a waiting shared table",
      () => stubNet({ role: "table", live: true, seat: null, room: ROOM }),
      () => translate(locale, "lobby.tableWaiting"),
    ],
    /* The table's own status line has two readings, and the welcomed one is
       reached only once the host has answered — so a stub with no status
       would never draw it and the criterion's fourth anchor would go
       unasserted. */
    [
      "a welcomed shared table",
      () => stubNet({ role: "table", live: true, seat: null, room: ROOM, status: "live" }),
      () => translate(locale, "lobby.tableSeated"),
    ],
  ] as const)(
    "explains the connection to %s in a room, after the status line",
    (_label, net, statusText) => {
      const { container } = renderWith(
        loadedState({ menu: "lobby" }),
        <Screens />,
        locale,
        1,
        net(),
      );
      const paras = [...container.querySelectorAll<HTMLElement>("p.dek")];
      const find = (text: string) => paras.find((p) => p.textContent === text);
      /* Every room page opens with lobby.roomWait, and the role's own status
         line follows it; both are anchors the criterion names. */
      const wait = find(translate(locale, "lobby.roomWait"));
      const status = find(statusText());
      const readable = find(translate(locale, "lobby.readable"));
      const relay = find(translate(locale, "lobby.roomRelay"));
      expect(wait).toBeTruthy();
      expect(status).toBeTruthy();
      expect(readable).toBeTruthy();
      expect(relay).toBeTruthy();
      const footer = container.querySelector(".lobbyfoot");
      expect(footer).toBeTruthy();
      const before = (a: Node, b: Node) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(before(wait!, status!)).toBe(true);
      expect(before(status!, readable!)).toBe(true);
      expect(before(readable!, relay!)).toBe(true);
      expect(before(relay!, footer!)).toBe(true);
    },
  );

  /* The code swap has no room and no relay, so the relay line would be a
     control that lies there — but hand visibility is true of both routes, so
     the first line still holds. */
  it.each([
    [
      "a guest on the code swap",
      () => stubNet({ role: "guest", live: true, seat: null, answer: CODE }),
    ],
    ["the shared table on the code swap", () => stubNet({ role: "table", live: true, seat: null })],
  ] as const)("tells %s hands are visible but names no relay with no room", (_label, net) => {
    const { container } = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, net());
    const text = container.textContent ?? "";
    expect(text).toContain(translate(locale, "lobby.readable"));
    expect(text).not.toContain(translate(locale, "lobby.roomRelay"));
  });

  /* Neither line belongs on the room-code entry page, on Other ways to
     connect, or on the code-swap host page: none of those three has a room
     this window is in — the entry page and Other ways have no session at
     all, and the code-swap host page is deliberately left with neither
     line, unlike its room-first counterpart. */
  it("draws neither connection line on the join page, Other ways, or the code-swap host page", () => {
    for (const render of [
      () => joinPage(),
      () => {
        const r = renderWith(loadedState({ menu: "lobby" }), <Screens />, locale);
        press(r.container, "btn.otherWays");
        return r;
      },
      () => renderWith(loadedState({ menu: "lobby" }), <Screens />, locale, 0, hostingNet()),
    ]) {
      const { container, unmount } = render();
      const text = container.textContent ?? "";
      for (const loc of LOCALE_ORDER)
        for (const key of ["lobby.readable", "lobby.roomRelay"] as const)
          expect(text).not.toContain(translate(loc, key));
      unmount();
    }
  });

  /* The banner is drawn outside Screens on purpose: .overlay is fixed and
     inset:0, so a warning underneath one is a warning nobody sees. */
  it("warns above every overlay when the peers drift apart", () => {
    const { container } = renderWith(
      loadedState({ screen: { kind: "gameover" } }),
      <App />,
      locale,
      1,
      stubNet({ role: "guest", live: true, seat: 1, status: "desync" }),
    );
    const banner = container.querySelector(".netbanner");
    expect(banner?.textContent).toContain(translate(locale, "net.desync"));
    expect(banner?.className).toContain("bad");
    expect(container.querySelector(".overlay")).not.toBeNull();
  });

  /* Behind the door is every mode played against the game — the roguelike
     included — and each of them builds a single-human board a guest's chair
     could not play, while Continue would be this window walking out of a
     session it has not left. The door asks now rather than refusing: no
     `disabled`, and one click opens the "hangup" confirmation instead of the
     single-player screen. */
  it.each(["host", "guest", "table"] as const)(
    "shuts the single-player door for a live %s",
    (role) => {
      const live = stubNet({ role, live: true, seat: role === "table" ? null : 0 });
      const g = loadedState({ menu: "start", runStarted: true });
      const btn = (c: HTMLElement) =>
        [...c.querySelectorAll<HTMLButtonElement>("button")].filter(
          (b) => b.textContent === translate(locale, "btn.singlePlayer"),
        )[0];

      const on = renderWith(g, <Screens />, locale, 0, live);
      /* A table draws no MoveButton at all, so it gets neither the door nor
         the reason line under it: an explanation of a button that is not on
         screen is worse than silence. */
      if (role === "table") {
        expect(btn(on.container)).toBeUndefined();
        expect(on.container.textContent).not.toContain(translate(locale, "menu.singleLive"));
        expect(on.dispatch).not.toHaveBeenCalled();
      } else {
        expect(btn(on.container).disabled).toBe(false);
        expect(on.container.textContent).toContain(translate(locale, "menu.singleLive"));
        fireEvent.click(btn(on.container));
        expect(on.dispatch.mock.calls).toEqual([[{ type: "openModal", modal: "hangup" }]]);
        expect(live.hangUp).not.toHaveBeenCalled();
      }
      on.unmount();

      /* And is open with no session, which is what makes the above worth
         asserting. */
      const off = renderWith(g, <Screens />, locale);
      expect(btn(off.container).disabled).toBe(false);
      fireEvent.click(btn(off.container));
      expect(off.dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "single" });
      expect(off.container.textContent).not.toContain(translate(locale, "menu.singleLive"));
    },
  );

  it("draws no banner with no session", () => {
    const { container } = renderWith(loadedState(), <App />, locale);
    expect(container.querySelector(".netbanner")).toBeNull();
  });

  /* The room's code stays on screen while the game is played, where a
     latecomer can read it off somebody's shoulder — for the *next* match,
     since a peer cannot be let into one under way. The banner is the one
     element outside .overlay, so the result screen is exactly where it has to
     survive, and it is text rather than a control: the banner eats no tap. */
  it("keeps the room's code on screen over a result screen", () => {
    const g = raceState({
      phase: "handend",
      screen: { kind: "raceover", winner: 0, scores: [RACE_TARGET + 400, 4100], deals: 8 },
    });
    const { container } = renderWith(
      g,
      <App />,
      locale,
      1,
      stubNet({ role: "guest", live: true, seat: 1, status: "live", room: ROOM }),
    );
    const code = container.querySelector(".netbanner .code");
    expect(code?.textContent).toContain(ROOM);
    expect(code?.textContent).toContain(translate(locale, "lobby.roomCode"));
    expect(code?.querySelectorAll("button, a, input, select")).toHaveLength(0);
    expect(container.querySelector(".overlay")).not.toBeNull();
  });

  /* The code swap has no room code at all, so there is nothing to draw rather
     than an empty chip. */
  it("draws no code in the banner on the code-swap route", () => {
    const { container } = renderWith(
      loadedState(),
      <App />,
      locale,
      1,
      stubNet({ role: "guest", live: true, seat: 1, status: "live" }),
    );
    expect(container.querySelector(".netbanner")).not.toBeNull();
    expect(container.querySelector(".netbanner .code")).toBeNull();
  });

  /* A window turned away at the door is told which door: "the link dropped"
     sent a refused player looking at their network, when what happened is
     that the match had already started. */
  it("says the host refused the connection", () => {
    const { container } = renderWith(
      loadedState(),
      <App />,
      locale,
      1,
      stubNet({ role: "guest", live: true, seat: null, status: "refused" }),
    );
    const banner = container.querySelector(".netbanner");
    expect(banner?.textContent).toContain(translate(locale, "net.refused"));
    expect(banner?.textContent).not.toContain(translate(locale, "net.dropped"));
    expect(banner?.className).toContain("bad");
  });

  /* The sweep above draws the lobby's table view. The other three are the
     session's, so a stub is what puts the window in them, and each is checked
     for the same leaks: nothing undefined, no catalogue key, no Finnish in
     English. */
  /* Most of these are drawn by the stub alone; the two Other-ways pages are a
     click down from a door, so every entry carries how to reach it. */
  const stay = () => {};
  it.each([
    ["the lobby hosting", "lobby", () => hostingNet(), stay],
    [
      "the lobby's room page",
      "lobby",
      () => stubNet(),
      (c: HTMLElement) => press(c, "btn.joinGame"),
    ],
    [
      "the lobby's host-setup page",
      "lobby",
      () => stubNet(),
      (c: HTMLElement) => press(c, "btn.openRoom"),
    ],
    [
      "the lobby as a seated guest",
      "lobby",
      () => stubNet({ role: "guest", live: true, seat: 2, answer: CODE }),
      stay,
    ],
    ["the lobby with a room open", "lobby", () => inRoom(), stay],
    [
      "the lobby as a guest in a room",
      "lobby",
      () => stubNet({ role: "guest", live: true, seat: 2, room: ROOM }),
      stay,
    ],
    [
      "the lobby's other ways, hosting",
      "lobby",
      () => stubNet(),
      (c: HTMLElement) => press(c, "btn.otherWays"),
    ],
    /* The joining side of the swap, reached the way a guest still reaches it
       without a link: the escape on the waiting page of a room that answered
       nobody, which hangs up on its way. */
    [
      "the lobby's other ways, joining",
      "lobby",
      () => stubNet({ role: "guest", live: true, seat: null, room: ROOM }),
      (c: HTMLElement) => press(c.querySelector<HTMLElement>(".netescape")!, "btn.otherWays"),
    ],
    /* The roguelike's refusal is prose nobody else's page draws, so it is
       swept for leaks like every other line. */
    ["the lobby with a chair answered", "lobby", () => hostingNet({ state: "connected" }), stay],
  ] as const)("renders %s", (label, menu, net, open) => {
    const { container } = renderWith(loadedState({ menu }), <Screens />, locale, 0, net());
    open(container);
    check(label, locale, container.textContent ?? "");
  });

  /* The lobby is a menu view, so a modal opened over it closes back to it and
     it covers the screen the resumed run is sitting on. */
  it("draws modal over lobby over screen", () => {
    const over = renderWith(loadedState({ menu: "lobby", modal: "rules" }), <Screens />, locale);
    expect(over.container.querySelector(".rules")).not.toBeNull();
    expect(over.container.querySelector(".lobbyfoot")).toBeNull();
    over.unmount();

    const under = renderWith(
      loadedState({ menu: "lobby", screen: { kind: "shop" }, shop: SHOP }),
      <Screens />,
      locale,
    );
    expect(under.container.querySelector(".lobbyfoot")).not.toBeNull();
    expect(under.container.querySelector(".shelf")).toBeNull();
  });

  /* A reseed or a replay must not silently move the player back to seat 0.
     Rendered at seat 2, so a hardcoded 0 prints where the seat belongs. */
  it("carries the viewing seat on every newRun outside the lobby", () => {
    const seed = renderWith(loadedState({ modal: "seed" }), <Screens />, locale, 2);
    const seedBtns = [...seed.container.querySelectorAll<HTMLElement>("button")];
    fireEvent.click(seedBtns.filter((b) => b.textContent === translate(locale, "btn.startRun"))[0]);
    fireEvent.click(
      seedBtns.filter((b) => b.textContent === translate(locale, "btn.replaySeed"))[0],
    );
    expect(seed.dispatch).toHaveBeenCalledWith({ type: "newRun", seed: "", seat: 2 });
    expect(seed.dispatch).toHaveBeenCalledWith({
      type: "newRun",
      seed: "RENDERTEST",
      seat: 2,
    });
    seed.unmount();

    const over = renderWith(loadedState({ screen: { kind: "gameover" } }), <Screens />, locale, 2);
    const overBtns = [...over.container.querySelectorAll<HTMLElement>("button")];
    fireEvent.click(overBtns.filter((b) => b.textContent === translate(locale, "btn.newGame"))[0]);
    fireEvent.click(
      overBtns.filter((b) => b.textContent === translate(locale, "btn.replaySeed"))[0],
    );
    expect(over.dispatch).toHaveBeenCalledWith({ type: "newRun", seat: 2 });
    expect(over.dispatch).toHaveBeenCalledWith({
      type: "newRun",
      seed: "RENDERTEST",
      seat: 2,
    });
    over.unmount();

    const win = renderWith(loadedState({ screen: { kind: "victory" } }), <Screens />, locale, 2);
    const winBtns = [...win.container.querySelectorAll<HTMLElement>("button")];
    fireEvent.click(winBtns.filter((b) => b.textContent === translate(locale, "btn.newGame"))[0]);
    expect(win.dispatch).toHaveBeenCalledWith({ type: "newRun", seat: 2 });
  });

  /* The table is not saved anywhere — a race is never saved at all — so the
     buttons carry the state's own seats. Four chairs replay as four chairs,
     and over the wire this is a flow action like any other. */
  it("replays a race at the table it was played at", () => {
    const seats: GameState["seats"] = ["human", "human", "ai", "human"];
    const g = raceState({
      phase: "handend",
      seats,
      raceScores: [RACE_TARGET + 400, 4100],
      screen: { kind: "raceover", winner: 0, scores: [RACE_TARGET + 400, 4100], deals: 8 },
    });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const at = (key: Parameters<typeof translate>[1]) =>
      [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, key),
      )[0];

    fireEvent.click(at("btn.playAgain"));
    fireEvent.click(at("btn.replaySeed"));
    expect(dispatch).toHaveBeenCalledWith({ type: "startChallenge", id: "race", seats });
    expect(dispatch).toHaveBeenCalledWith({
      type: "startChallenge",
      id: "race",
      seed: g.seed,
      seats,
    });
  });

  /* Both replay buttons carry the mode the state is in, not a literal: a
     traditional match replayed as a race would change the scale under the
     player between one click and the next. Two separate JSX blocks, so both
     are clicked. */
  it("replays a traditional match as a traditional match", () => {
    const seats: GameState["seats"] = ["human", "human", "ai", "human"];
    const g = tradState({
      phase: "handend",
      seats,
      raceScores: [TUPPI_TARGET + 4, 0],
      screen: { kind: "raceover", winner: 0, scores: [TUPPI_TARGET + 4, 0], deals: 9 },
    });
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const at = (key: Parameters<typeof translate>[1]) =>
      [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, key),
      )[0];

    fireEvent.click(at("btn.playAgain"));
    fireEvent.click(at("btn.replaySeed"));
    expect(dispatch).toHaveBeenCalledWith({ type: "startChallenge", id: "tuppi", seats });
    expect(dispatch).toHaveBeenCalledWith({
      type: "startChallenge",
      id: "tuppi",
      seed: g.seed,
      seats,
    });
    const started = dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "startChallenge");
    expect(started.every((a) => a.type === "startChallenge" && a.id === "tuppi")).toBe(true);
  });

  /* Two modes behind one screen kind, so the heading has to say which one is
     over — and the deciding deal has to be read on that mode's own scale. */
  it("names the mode on the match-over screen and reads its own last deal", () => {
    const trad = tradState({
      phase: "handend",
      mode: "rami",
      ramTeam: 0,
      tricks: [10, 3],
      raceScores: [TUPPI_TARGET + 4, 0],
      screen: { kind: "raceover", winner: 0, scores: [TUPPI_TARGET + 4, 0], deals: 9 },
    });
    const trText = renderWith(trad, <Screens />, locale).container.textContent ?? "";
    expect(trText).toContain(
      translate(locale, "matchOver.title", { mode: nameOfIn(locale, CHALLENGES[2]) }),
    );
    expect(trText).not.toContain(nameOfIn(locale, CHALLENGES[1]));
    /* Ten tricks on a rami this pair declared: (10 - 6) x 4 = 16 points, not
       the race's chips - raceBase is [0, 0] in this mode. */
    const trLine = [
      ...renderWith(trad, <Screens />, locale).container.querySelectorAll(".cashline"),
    ]
      .map((l) => l.textContent ?? "")
      .find((x) => x.includes(translate(locale, "raceOver.lastDeal")));
    expect(trLine).toContain(formatNumber(locale, 16));

    const race = raceState({
      phase: "handend",
      raceScores: [RACE_TARGET + 400, 4100],
      screen: { kind: "raceover", winner: 0, scores: [RACE_TARGET + 400, 4100], deals: 8 },
    });
    const rcText = renderWith(race, <Screens />, locale).container.textContent ?? "";
    expect(rcText).toContain(
      translate(locale, "matchOver.title", { mode: nameOfIn(locale, CHALLENGES[1]) }),
    );
    expect(rcText).not.toContain(nameOfIn(locale, CHALLENGES[2]));
  });

  /* The deal-end screen is the same fork one screen earlier. */
  it("shows a traditional deal's points, not a race's chips", () => {
    const g = tradState({
      phase: "handend",
      mode: "nolo",
      ramTeam: null,
      tricks: [3, 10],
      screen: { kind: "dealend", score: 16 },
    });
    const { container } = renderWith(g, <Screens />, locale);
    const line = [...container.querySelectorAll(".cashline")]
      .map((l) => l.textContent ?? "")
      .find((x) => x.includes(translate(locale, "raceDeal.thisDeal")));
    /* Three tricks in nolo: (7 - 3) x 4 = 16. */
    expect(line).toContain(formatNumber(locale, 16));
    expect(container.textContent).toContain(translate(locale, "matchDeal.total"));
    expect(container.textContent).toContain(formatNumber(locale, TUPPI_TARGET));
    expect(container.textContent).not.toContain(translate(locale, "matchDeal.reset"));
  });

  it.each([0, 1] as const)(
    "explains a traditional reset from seat %i without awarding raw deal points",
    (seat) => {
      const ended = gameReducer(
        tradState({
          phase: "trickend",
          screen: null,
          trickNo: 12,
          mode: "rami",
          ramTeam: 0,
          tricks: [6, 7],
          raceScores: [20, 0],
        }),
        { type: "endTrick" },
      );
      const g = gameReducer(ended, { type: "showHandResult" });
      const { container, dispatch } = renderWith(g, <Screens />, locale, seat);
      const text = container.textContent ?? "";
      check("traditional reset", locale, text);
      expect(text).toContain(translate(locale, "matchDeal.reset"));
      expect(
        [...container.querySelectorAll(".cashline b")].slice(0, 4).map((b) => b.textContent),
      ).toEqual([
        "0",
        "0",
        `0 / ${formatNumber(locale, TUPPI_TARGET)}`,
        `0 / ${formatNumber(locale, TUPPI_TARGET)}`,
      ]);
      const next = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === translate(locale, "btn.nextDeal"),
      )!;
      fireEvent.click(next);
      expect(dispatch).toHaveBeenCalledWith({ type: "nextDeal" });
    },
  );

  it("does not describe a zero-total race deal as a traditional reset", () => {
    const g = raceState({
      phase: "handend",
      raceScores: [0, 0],
      screen: { kind: "dealend", score: 0 },
    });
    const { container } = renderWith(g, <Screens />, locale);
    expect(container.textContent).not.toContain(translate(locale, "matchDeal.reset"));
  });

  it("goes back to the menu from the single-player screen", () => {
    const { container, dispatch } = renderWith(
      loadedState({ menu: "single" }),
      <Screens />,
      locale,
    );
    const back = [...container.querySelectorAll<HTMLElement>("button")].filter(
      (b) => b.textContent === translate(locale, "btn.back"),
    );
    expect(back).toHaveLength(1);
    fireEvent.click(back[0]);
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });

  /* Mid-trick is the case that used to start a run on the spot behind a
     confirmation; now every state routes through the menu, and Continue there
     is what returns to the deal. */
  it("raises the menu from the rail instead of starting a run", () => {
    const g = loadedState({ phase: "play", trickNo: 3 });
    const { container, dispatch } = renderWith(g, <Rail />, locale);
    const btn = [...container.querySelectorAll<HTMLElement>(".railbtns button")].filter(
      (b) => b.textContent === translate(locale, "btn.menu"),
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

/* The laydown's workspace is component state and is committed by one action.
   What a test can hold is the wiring: what a click selects, what a row takes,
   and that nothing is dispatched until Lay. */
describe("the laydown panel", () => {
  const handCards = (root: Element) => [...root.querySelectorAll<HTMLElement>(".layhand .laycard")];
  const rows = (root: Element) => [...root.querySelectorAll<HTMLElement>(".layrow:not(.newrow)")];
  const newRow = (root: Element) => root.querySelector<HTMLButtonElement>(".layrow.newrow")!;
  const layBtn = (root: Element) =>
    [...root.querySelectorAll<HTMLButtonElement>(".layfoot button")][0];

  it("dispatches nothing until Lay, and then the whole table", () => {
    const g = laydownState();
    const { container, dispatch } = renderWith(g, <Panels />);
    /* Three nines in hand and a run on the table: a fresh set of three is the
       one legal turn that does not touch the table. */
    const nines = g.layHands[0].filter((c) => c.r === 9);
    expect(nines).toHaveLength(3);

    expect(layBtn(container).disabled).toBe(true);
    /* The hand is sorted, so the three nines are its tail. The first goes to a
       row of its own and the other two join it. */
    const last = () => handCards(container)[handCards(container).length - 1];
    fireEvent.click(last());
    fireEvent.click(newRow(container));
    fireEvent.click(last());
    fireEvent.click(rows(container)[1]);
    fireEvent.click(last());
    fireEvent.click(rows(container)[1]);
    expect(dispatch).not.toHaveBeenCalled();
    expect(rows(container)).toHaveLength(2);
    expect(layBtn(container).disabled).toBe(false);

    fireEvent.click(layBtn(container));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const sent = dispatch.mock.calls[0][0] as { type: string; combos: string[][] };
    expect(sent.type).toBe("layCards");
    /* The table's own row is carried through untouched: nothing may leave it. */
    expect(sent.combos[0]).toEqual(g.table[0].map((c) => c.uid));
    expect(sent.combos[1].sort()).toEqual(nines.map((c) => c.uid).sort());
  });

  it("keeps Lay disabled while the proposal is illegal", () => {
    const g = laydownState();
    const { container, dispatch } = renderWith(g, <Panels />);
    fireEvent.click(handCards(container)[0]);
    fireEvent.click(newRow(container));
    /* One card is not a combination. */
    expect(layBtn(container).disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("takes the workspace back on Reset", () => {
    const g = laydownState();
    const { container } = renderWith(g, <Panels />);
    const before = handCards(container).length;
    fireEvent.click(handCards(container)[0]);
    fireEvent.click(newRow(container));
    expect(handCards(container)).toHaveLength(before - 1);
    const reset = [...container.querySelectorAll<HTMLElement>(".layfoot button")][1];
    fireEvent.click(reset);
    expect(handCards(container)).toHaveLength(before);
    expect(rows(container)).toHaveLength(g.table.length);
  });

  it("passes the turn", () => {
    const { container, dispatch } = renderWith(laydownState(), <Panels />);
    const pass = [...container.querySelectorAll<HTMLElement>(".layfoot button")][2];
    fireEvent.click(pass);
    expect(dispatch).toHaveBeenCalledWith({ type: "passLaydown", p: 0 });
  });

  it("acts on nothing while it is the opponents' turn", () => {
    const { container } = renderWith(laydownState({ layTurn: 1 }), <Panels />);
    for (const b of container.querySelectorAll<HTMLButtonElement>(".layfoot button"))
      expect(b.disabled).toBe(true);
    /* No bar either: the sixty seconds are the player's own. */
    expect(container.querySelector(".laytimer")).toBeNull();
  });
});

/* g.target is a blind's target in the main game and the match target in a
   race, and the sooli offer draws it. The label has to follow the mode, or a
   race — which has no blind at all — announces a blind target the deal is not
   being played for. */
describe("the sooli offer's target line follows the mode", () => {
  const line = (container: HTMLElement, label: string) =>
    [...container.querySelectorAll(".ln")].find((l) => l.textContent?.startsWith(label));

  it.each(LOCALE_ORDER)("names the race's target in a race, in %s", (locale) => {
    const { container } = renderWith(
      raceState({ phase: "soolioffer", ramSeat: 1, ramTeam: 1, sooliSeat: 0 }),
      <Panels />,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain(translate(locale, "sooli.target"));
    const row = line(container, translate(locale, "sooli.matchTarget"));
    expect(row?.textContent).toContain(formatNumber(locale, RACE_TARGET));
  });

  it.each(LOCALE_ORDER)("names the match target in a traditional match, in %s", (locale) => {
    const { container } = renderWith(
      tradState({ phase: "soolioffer", ramSeat: 1, ramTeam: 1, sooliSeat: 0 }),
      <Panels />,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain(translate(locale, "sooli.target"));
    const row = line(container, translate(locale, "sooli.matchTarget"));
    expect(row?.textContent).toContain(formatNumber(locale, TUPPI_TARGET));
  });

  /* The value lines are the rule, not decoration: a traditional sooli is
     worth 24 points either way and has no multiplier at all, so the race's
     "x6, all 13 tricks" would name arithmetic this mode does not use. */
  it.each(LOCALE_ORDER)("says 24 points either way in a traditional match, in %s", (locale) => {
    const { container } = renderWith(
      tradState({ phase: "soolioffer", ramSeat: 1, ramTeam: 1, sooliSeat: 0 }),
      <Panels />,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(translate(locale, "sooli.onSuccessValPoints"));
    expect(text).toContain(translate(locale, "sooli.onFailValPoints"));
    expect(text).not.toContain(translate(locale, "sooli.onSuccessVal"));
    expect(text).not.toContain(translate(locale, "sooli.onFailVal"));
  });

  it.each(LOCALE_ORDER)("keeps the multiplier lines in a race, in %s", (locale) => {
    const { container } = renderWith(
      raceState({ phase: "soolioffer", ramSeat: 1, ramTeam: 1, sooliSeat: 0 }),
      <Panels />,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(translate(locale, "sooli.onSuccessVal"));
    expect(text).toContain(translate(locale, "sooli.onFailVal"));
    expect(text).not.toContain(translate(locale, "sooli.onSuccessValPoints"));
    expect(text).not.toContain(translate(locale, "sooli.onFailValPoints"));
  });

  it.each(LOCALE_ORDER)("still names the blind's target in a main run, in %s", (locale) => {
    const { container } = renderWith(
      loadedState({ phase: "soolioffer", sooliSeat: 0, target: 1250 }),
      <Panels />,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain(translate(locale, "sooli.matchTarget"));
    const row = line(container, translate(locale, "sooli.target"));
    expect(row?.textContent).toContain(formatNumber(locale, 1250));
  });
});

describe.each(LOCALE_ORDER)("match sooli decisions (%s)", (locale) => {
  describe.each(["race", "tuppi"] as const)("%s", (challenge) => {
    const firstOffer = (first: Seat) => {
      const dealer = ((first + 3) % 4) as Seat;
      return gameReducer(
        raceState({
          challenge,
          target: challenge === "tuppi" ? TUPPI_TARGET : RACE_TARGET,
          phase: "declare",
          dealer,
          seats: ["human", "human", "human", "human"],
          declSeq: [1, 2, 3, 4].map((n) => ((dealer + n) % 4) as Seat),
          declIdx: 4,
          shows: [0, 1, 2, 3].map((p) => ({
            decl: p === 0 ? "rami" : "nolo",
            card: null,
          })) as GameState["shows"],
        }),
        { type: "finishDeclare" },
      );
    };

    it.each([1, 3] as const)("passes seat %i's offer and lets the second human accept", (first) => {
      const g = firstOffer(first);
      expect(g.phase).toBe("soolioffer");
      expect(g.sooliSeat).toBe(first);
      const view = renderWith(g, <Panels />, locale, first);
      expect(view.container.textContent).toContain(translate(locale, "sooli.priority"));
      fireEvent.click(view.getByRole("button", { name: translate(locale, "btn.passSooli") }));
      expect(view.dispatch).toHaveBeenCalledExactlyOnceWith({ type: "declineSooli", p: first });
      const second = gameReducer(g, view.dispatch.mock.calls[0][0]);
      const actor = (first === 1 ? 3 : 1) as Seat;
      expect(second.phase).toBe("soolioffer");
      expect(second.sooliSeat).toBe(actor);
      view.unmount();

      const waiting = renderWith(
        second,
        <>
          <Panels />
          <Hint />
        </>,
        locale,
        first,
      );
      expect(waiting.container.querySelector("#declpanel")).toBeNull();
      expect(waiting.container.querySelector("button")).toBeNull();
      expect(waiting.container.textContent).toBe(
        translate(locale, "hint.sooliWait", { who: SEATS[actor].name }),
      );
      expect(waiting.dispatch).not.toHaveBeenCalled();
      waiting.unmount();

      const offered = renderWith(
        second,
        <Panels />,
        locale,
        actor,
        stubNet({ role: "guest", live: true, seat: actor, status: "live" }),
      );
      fireEvent.click(offered.getByRole("button", { name: translate(locale, "btn.playSooli") }));
      expect(offered.dispatch).toHaveBeenCalledExactlyOnceWith({ type: "acceptSooli", p: actor });
      const give = gameReducer(second, offered.dispatch.mock.calls[0][0]);
      expect(give.phase).toBe("sooligive");
      expect(give.sooliSeat).toBe(actor);
      offered.unmount();

      const hand = renderWith(give, <Hand />, locale, actor);
      fireEvent.click(hand.container.querySelector(".hcard")!);
      expect(hand.dispatch).toHaveBeenCalledExactlyOnceWith({
        type: "sooliGive",
        p: actor,
        uid: give.hands[actor][0].uid,
      });
      const ready = gameReducer(give, hand.dispatch.mock.calls[0][0]);
      expect(ready.phase).toBe("sooliready");
      expect(ready.sooliExchange).not.toBeNull();
      hand.unmount();

      const exchanged = renderWith(ready, <Panels />, locale, actor);
      expect(exchanged.container.querySelectorAll(".sidedeck .card")).toHaveLength(2);
      expect(exchanged.container.textContent).toContain(cardName(ready.sooliExchange!.got));
      fireEvent.click(
        exchanged.getByRole("button", { name: translate(locale, "sooliDone.start") }),
      );
      expect(exchanged.dispatch).toHaveBeenCalledExactlyOnceWith({
        type: "startSooliPlay",
        p: actor,
      });
      expect(gameReducer(ready, exchanged.dispatch.mock.calls[0][0]).phase).toBe("play");
      exchanged.unmount();
    });

    describe.each(["human", "ai"] as const)("acting %s", (kind) => {
      it.each([1, 3] as const)(
        "keeps seat %i's phases private and other hands sortable",
        (actor) => {
          const offer = firstOffer(actor);
          const give = gameReducer(offer, { type: "acceptSooli", p: actor });
          const ready = gameReducer(give, {
            type: "sooliGive",
            p: actor,
            uid: give.hands[actor][0].uid,
          });
          expect([offer.phase, give.phase, ready.phase]).toEqual([
            "soolioffer",
            "sooligive",
            "sooliready",
          ]);
          for (const state of [offer, give, ready]) {
            const g = {
              ...state,
              seats: state.seats.map((k, p) => (p === actor ? kind : k)) as GameState["seats"],
            };
            for (const you of [0, 1, 2, 3] as Seat[]) {
              if (you === actor && kind === "human") continue;
              const view = renderWith(
                g,
                <>
                  <Panels />
                  <Hint />
                </>,
                locale,
                you,
                stubNet({ role: "guest", live: true, seat: you, status: "live" }),
              );
              expect(view.container.querySelector("#declpanel")).toBeNull();
              expect(view.container.querySelector("button")).toBeNull();
              expect(view.container.querySelector(".card")).toBeNull();
              expect(view.container.textContent).toBe(
                translate(locale, "hint.sooliWait", { who: SEATS[actor].name }),
              );
              check("waiting sooli", locale, view.container.textContent ?? "");
              expect(view.dispatch).not.toHaveBeenCalled();
              view.unmount();

              if (g.phase !== "sooligive") continue;
              const hand = renderWith(g, <Hand />, locale, you);
              const c = hand.container.querySelector(".hcard")!;
              expect(c).not.toBeNull();
              fireEvent.click(c);
              fireEvent.keyDown(c, { key: "Enter" });
              fireEvent.keyDown(c, { key: " " });
              expect(hand.dispatch).not.toHaveBeenCalled();
              fireEvent.click(hand.getByRole("button", { name: translate(locale, "hand.byRank") }));
              expect(hand.dispatch).toHaveBeenCalledExactlyOnceWith({
                type: "setSortMode",
                p: you,
                mode: "rank",
              });
              hand.dispatch.mockClear();
              fireEvent.keyDown(c, { key: "ArrowRight", altKey: true });
              expect(hand.dispatch).toHaveBeenCalledExactlyOnceWith({
                type: "moveCard",
                p: you,
                uid: g.hands[you][0].uid,
                dir: 1,
              });
              hand.unmount();
            }

            const table = renderWith(
              g,
              <>
                <Panels />
                <Hint />
              </>,
              locale,
              actor,
              stubNet({ role: "table", live: true, seat: null, status: "live" }),
            );
            expect(table.container.querySelector("#declpanel")).toBeNull();
            expect(table.container.querySelector("button")).toBeNull();
            expect(table.container.querySelector(".card")).toBeNull();
            expect(table.container.textContent).toBe(
              translate(locale, "hint.sooliWait", { who: SEATS[actor].name }),
            );
            expect(table.dispatch).not.toHaveBeenCalled();
            table.unmount();
          }
        },
      );
    });

    it("distinguishes house priority from the source rules", () => {
      const rules = translateList(locale, challenge === "race" ? "rules.race" : "rules.trad").join(
        " ",
      );
      expect(rules).toContain(locale === "fi" ? "talon sääntö" : "house rule");
      expect(rules).toContain(locale === "fi" ? "ihmisille ennen botteja" : "humans before bots");
      expect(rules).toContain(locale === "fi" ? "jakajan vasemmalta" : "dealer's left");
      expect(translateList(locale, "rules.tuppi").join(" ")).not.toContain(
        locale === "fi" ? "talon sääntö" : "house rule",
      );
    });
  });

  it("offers the house priority notice and the pass label in the main game too", () => {
    const { container, getByRole, dispatch } = renderWith(
      loadedState({ phase: "soolioffer", sooliSeat: 0 }),
      <Panels />,
      locale,
    );
    expect(container.textContent).toContain(translate(locale, "sooli.priority"));
    fireEvent.click(getByRole("button", { name: translate(locale, "btn.passSooli") }));
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: "declineSooli", p: 0 });
  });
});

/* Leaving is the result screen's decision now, and those two screens are the
   only sites that dispatch it: one click gives the parked run back, and a
   challenge in progress is played out rather than handed back mid-deal.

   Over a live session the same click hangs up first. The parked run it restores
   is this window's own, so there is nothing shared to broadcast — the action is
   `local` — and a window that restored its run while still sequencing would
   number its own ticks into a match the others are still playing. */
describe("a challenge is left from its result screen", () => {
  const RESULTS = [
    [
      "the Tuppi-Rummikub result",
      () => laydownState({ phase: "handend", screen: { kind: "challengeover", score: 137 } }),
    ],
    [
      "the race result",
      () =>
        raceState({
          phase: "handend",
          screen: { kind: "raceover", winner: 0, scores: [12400, 7100], deals: 8 },
        }),
    ],
  ] as const;

  describe.each(LOCALE_ORDER)("in %s", (locale) => {
    it.each(RESULTS)("gives the parked run back from %s", (_label, state) => {
      const { container, dispatch } = renderWith(state(), <Screens />, locale);
      const btn = [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.backToRun"),
      );
      expect(btn).toHaveLength(1);
      fireEvent.click(btn[0]);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({ type: "leaveChallenge" });
      expect(dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "showMenu")).toEqual([]);
    });

    /* Offline the click is unchanged, so the hang-up has to be gated: a window
       with no session has nothing to hang up, and calling it anyway would be a
       no-op today and a bug the day the default stops being one. */
    it.each(RESULTS)("hangs nothing up offline from %s", (_label, state) => {
      const { container, net } = renderWith(state(), <Screens />, locale);
      const btn = [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.backToRun"),
      );
      fireEvent.click(btn[0]);
      expect(net.hangUp).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain(translate(locale, "net.leaveHangsUp"));
    });

    /* And in a session the same click is a hang-up and a leave, and nothing
       else: not a menu, not a new run, and not the match starting over. */
    it.each(RESULTS)("hangs the session up and leaves from %s", (_label, state) => {
      const { container, dispatch, net } = renderWith(
        state(),
        <Screens />,
        locale,
        0,
        stubNet({ role: "host", live: true, status: "live", seat: 0 }),
      );
      expect(container.textContent).toContain(translate(locale, "net.leaveHangsUp"));
      const btn = [...container.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.backToRun"),
      );
      expect(btn).toHaveLength(1);
      fireEvent.click(btn[0]);
      expect(net.hangUp).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: "leaveChallenge" }]);
      /* Named as well as counted: the three siblings on that row are what a
         mis-wired handler would reach. */
      expect(
        dispatch.mock.calls
          .map((c) => c[0].type)
          .filter((type) => type === "showMenu" || type === "newRun" || type === "startChallenge"),
      ).toEqual([]);
    });

    /* And the menu raised over a challenge with nothing parked offers no way
       out, from any of its buttons: `Menu`'s Continue is the third
       leaveChallenge site, but it is drawn only for a parked solo run, which
       this state does not have. */
    it("leaves no challenge from the menu", () => {
      const { container, dispatch } = renderWith(
        laydownState({ menu: "start", runStarted: true }),
        <Screens />,
        locale,
      );
      for (const b of container.querySelectorAll<HTMLElement>("button")) fireEvent.click(b);
      expect(
        dispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "leaveChallenge"),
      ).toEqual([]);
    });
  });
});

/* Each row reads its own board, and only its own. A separate block because
   the boards are read through game/storage.ts while the row renders, and the
   rendering sweep above installs no store — jsdom provides none, so every
   write there is silently swallowed and every row would read as empty. */
describe.each(LOCALE_ORDER)(
  "the single-player rows and the lobby read their boards (%s)",
  (locale) => {
    beforeEach(stubStorageWithBoard);

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /* In CHALLENGES order: Tuppi-Rummikub, the race, Traditional Tuppi. */
    const rows = (container: HTMLElement) => [...container.querySelectorAll("li.chalrow")];
    const lobby = (container: HTMLElement) => container.querySelector(".lobbymode");

    /* This describe.each has no access to the "rendering" block's own press,
       so a local one: the mode picker moved off the landing page and onto the
       host-setup page, which Open a room now navigates to. */
    const press = (c: HTMLElement, key: LocaleKey) =>
      fireEvent.click(
        [...c.querySelectorAll<HTMLButtonElement>("button")].find(
          (b) => b.textContent === translate(locale, key),
        )!,
      );

    const inLobby = (match: MatchId) => {
      const { container } = renderWith(
        loadedState({ menu: "lobby" }),
        <Screens />,
        locale,
        0,
        stubNet({ match }),
      );
      press(container, "btn.openRoom");
      return container;
    };
    const inList = () => renderWith(loadedState({ menu: "single" }), <Screens />, locale).container;

    /* Two board shapes over three rows, and which parser a row uses follows its
       id rather than the screen: a RaceRow is a superset of a ChallengeRow and
       both board versions are 1, so readChallengeScores("race") would parse
       nothing at all — it reads the empty tupatro-challenge-race-v1 and would
       report "no result yet" for every match ever won. */
    it("gives each match its own won-in-N-deals line and the challenge a score", () => {
      writeChallengeScores("rummikub", [{ seed: "CH", score: 640, at: 1 }]);
      writeRaceScores("race", [{ seed: "RC", won: true, deals: 6, score: 12300, at: 1 }]);
      writeRaceScores("tuppi", [{ seed: "TR", won: true, deals: 31, score: 54, at: 1 }]);

      const [rummikub, race, trad] = rows(inList());
      expect(rummikub.textContent).toContain(
        translate(locale, "challenges.best", { score: formatNumber(locale, 640) }),
      );
      expect(race.textContent).toContain(
        translate(locale, "race.bestWon", { deals: formatNumber(locale, 6) }),
      );
      expect(trad.textContent).toContain(
        translate(locale, "race.bestWon", { deals: formatNumber(locale, 31) }),
      );
      /* No row reads another's number. */
      expect(rummikub.textContent).not.toContain(formatNumber(locale, 12300));
      expect(race.textContent).not.toContain(formatNumber(locale, 640));
      expect(trad.textContent).not.toContain(formatNumber(locale, 6));
      /* And the lobby reads the same two match boards, since a match is
         started from both doors. */
      expect(lobby(inLobby("race"))?.textContent).toContain(
        translate(locale, "race.bestWon", { deals: formatNumber(locale, 6) }),
      );
      expect(lobby(inLobby("tuppi"))?.textContent).toContain(
        translate(locale, "race.bestWon", { deals: formatNumber(locale, 31) }),
      );
    });

    /* The host-setup page opens on Multiplayer Tupatro, so with no mode named
       at all its best line reads that mode's own board — not the race's and
       not the traditional match's. */
    it("reads Multiplayer Tupatro's own board on the host-setup page by default", () => {
      writeRaceScores("tupatro", [{ seed: "MT", won: true, deals: 9, score: 60, at: 1 }]);
      writeRaceScores("race", [{ seed: "RC", won: true, deals: 6, score: 12300, at: 1 }]);
      writeRaceScores("tuppi", [{ seed: "TR", won: true, deals: 31, score: 54, at: 1 }]);
      const { container } = renderWith(
        loadedState({ menu: "lobby" }),
        <Screens />,
        locale,
        0,
        stubNet(),
      );
      press(container, "btn.openRoom");
      const mode = lobby(container);
      expect(mode?.textContent).toContain(
        translate(locale, "race.bestWon", { deals: formatNumber(locale, 9) }),
      );
      expect(mode?.textContent).not.toContain(
        translate(locale, "race.bestWon", { deals: formatNumber(locale, 6) }),
      );
      expect(mode?.textContent).not.toContain(
        translate(locale, "race.bestWon", { deals: formatNumber(locale, 31) }),
      );
    });

    it("says there is no result yet when a match board holds only a loss", () => {
      writeRaceScores("race", [{ seed: "RC", won: false, deals: 12, score: 4000, at: 1 }]);
      expect(rows(inList())[1].textContent).toContain(translate(locale, "challenges.noBest"));
      expect(lobby(inLobby("race"))?.textContent).toContain(translate(locale, "challenges.noBest"));
    });

    it("says the same with no rows at all", () => {
      for (const row of rows(inList()))
        expect(row.textContent).toContain(translate(locale, "challenges.noBest"));
      expect(lobby(inLobby("race"))?.textContent).toContain(translate(locale, "challenges.noBest"));
    });
  },
);

/* A saved slot's own Continue, its position line, and the in-row confirmation
   Play draws over it when there is something to lose. Each is read from
   game/storage.ts the same way the best-result line already is — the render
   sweep above installs no store, so this block installs one itself. */
describe.each(LOCALE_ORDER)("the single-player screen's saved rows (%s)", (locale) => {
  beforeEach(stubStorageWithBoard);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* Built by actually starting the challenge, then overwriting the one or two
     fields the position line reads — so every other field a real save carries
     (economies, hands, the deck) is present and rehydrate has nothing to
     refuse. */
  function seedRummikub(deal: number, deals: number) {
    const base = gameReducer(createRun("SAVEDCHAL"), { type: "startChallenge", id: "rummikub" });
    writeChallengeRun("rummikub", dehydrate({ ...base, deals, dealsLeft: deals - deal }));
  }

  function seedRace(deal: number, us: number, them: number) {
    const base = gameReducer(createRun("SAVEDRACE"), { type: "startChallenge", id: "race" });
    writeChallengeRun("race", dehydrate({ ...base, raceDeal: deal, raceScores: [us, them] }));
  }

  const rows = (container: HTMLElement) => [...container.querySelectorAll("li.chalrow")];
  const among = (root: Element, key: LocaleKey) =>
    [...root.querySelectorAll<HTMLElement>("button")].find(
      (b) => b.textContent === translate(locale, key),
    );

  it("draws the saved position above the best-result line for a saved deal and a saved match", () => {
    seedRummikub(3, 4);
    seedRace(8, 9000, 4500);
    const list = rows(renderWith(loadedState({ menu: "single" }), <Screens />, locale).container);

    expect(list[0].textContent).toContain(
      translate(locale, "single.savedDeals", {
        deal: formatNumber(locale, 3),
        deals: formatNumber(locale, 4),
      }),
    );
    expect(list[1].textContent).toContain(
      translate(locale, "single.savedMatch", {
        deal: formatNumber(locale, 8),
        us: formatNumber(locale, 9000),
        them: formatNumber(locale, 4500),
      }),
    );
    /* Traditional Tuppi has no save here at all: no position line, no
       Continue. */
    expect(among(list[2], "btn.continue")).toBeUndefined();
  });

  it("draws Continue for a saved slot, dispatching resumeGame with the raw payload", () => {
    seedRummikub(1, 4);
    const raw = JSON.parse(localStorage.getItem("tupatro-run-rummikub-v1")!) as unknown;
    const { container, dispatch } = renderWith(
      loadedState({ menu: "single" }),
      <Screens />,
      locale,
    );
    const btn = among(rows(container)[0], "btn.continue");
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(dispatch).toHaveBeenCalledWith({ type: "resumeGame", saved: raw });
  });

  it("draws Continue for the game this window is already in, dispatching closeMenu", () => {
    const g = {
      ...gameReducer(createRun("LIVECHAL"), { type: "startChallenge", id: "race" }),
      menu: "single" as const,
    };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const btn = among(rows(container)[1], "btn.continue");
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(dispatch).toHaveBeenCalledWith({ type: "closeMenu" });
  });

  it("asks before Play replaces a saved slot, drawn in place of the row's buttons", () => {
    seedRummikub(1, 4);
    const { container, dispatch } = renderWith(
      loadedState({ menu: "single" }),
      <Screens />,
      locale,
    );
    const row = rows(container)[0];
    fireEvent.click(among(row, "btn.play")!);
    expect(row.textContent).toContain(
      translate(locale, "single.replaceAsk", { name: nameOfIn(locale, CHALLENGES[0]) }),
    );
    expect(among(row, "btn.continue")).toBeUndefined();
    fireEvent.click(among(row, "btn.cancel")!);
    expect(dispatch).not.toHaveBeenCalled();
    expect(among(row, "btn.play")).toBeDefined();
  });

  it("confirms replacing a saved slot with exactly startChallenge and no seats or seed", () => {
    seedRummikub(1, 4);
    const { container, dispatch } = renderWith(
      loadedState({ menu: "single" }),
      <Screens />,
      locale,
    );
    const row = rows(container)[0];
    fireEvent.click(among(row, "btn.play")!);
    fireEvent.click(among(row, "btn.yesRestart")!);
    expect(dispatch).toHaveBeenCalledWith({ type: "startChallenge", id: "rummikub" });
  });
});

/* No button on this screen may move the game for a peer with no chair, and
   `onlyLocal` cannot be the check: resumeGame is `local`, so it filters the
   very dispatch this test exists to rule out. Named assertions instead, with
   all four slots seeded so every row and the roguelike's own Continue would
   draw if anything here were reachable. */
describe("a table on the single-player screen with every slot saved", () => {
  beforeEach(stubStorageWithBoard);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws no Continue or Play, and dispatches neither resumeGame nor startChallenge", () => {
    writeRun(dehydrate(createRun("TABLEMAIN")));
    for (const id of ["rummikub", "race", "tuppi"] as const)
      writeChallengeRun(
        id,
        dehydrate(gameReducer(createRun(`TABLE-${id}`), { type: "startChallenge", id })),
      );

    const g = loadedState({ menu: "single", runStarted: true });
    const { container, dispatch } = renderWith(
      g,
      <Screens />,
      "fi",
      0,
      stubNet({ role: "table", live: true, seat: null }),
    );
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    expect(labels).not.toContain(translate("fi", "btn.continue"));
    expect(labels).not.toContain(translate("fi", "btn.play"));

    for (const b of [...container.querySelectorAll<HTMLElement>("button")]) fireEvent.click(b);
    const sent = dispatch.mock.calls.map(([a]) => a.type);
    expect(sent).not.toContain("resumeGame");
    expect(sent).not.toContain("startChallenge");
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
    also?: StateOver;
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
    /* The challenge's own board, not the main one — but a board all the same,
       so the run that just ended is on screen with its result. */
    challengeover: {
      label: "the challenge-over screen",
      screen: { kind: "challengeover", score: 137 },
      also: { challenge: "rummikub" },
      how: "drawn",
    },
    /* The race's own board, and a third one — but a board all the same, so
       the match that just ended is on screen with its result. */
    raceover: {
      label: "the race-over screen",
      screen: { kind: "raceover", winner: 0, scores: [12400, 7100], deals: 8 },
      also: { challenge: "race", target: RACE_TARGET, raceScores: [12400, 7100] },
      how: "drawn",
    },
    /* Rock-Paper-Scissors' own board, an eighth component reading one while
       it renders. */
    rpsover: {
      label: "the rps-over screen",
      screen: { kind: "rpsover", result: "won", wins: [7, 4] },
      also: { challenge: "rps", rpsWins: [7, 4], rpsRound: RPS_ROUNDS },
      how: "drawn",
    },
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

/* ==================== the shared table ====================
   A window that holds no chair: it draws the felt, the trick, the four chairs
   and the score, and nothing that belongs to one player. Three layers keep it
   read-only and each is tested where it lives — guestSession before the wire
   and guestMay at the host's door, both in src/net/ — and this is the third:
   nothing on the screen can move the game, because nothing on the screen is a
   control that would. */
/* The two rows of the main game's trick tally, which is the one rail plate
   that names a side. */
const tallyLabels = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>(".tally .lbl")].map((e) => e.textContent);

describe.each(LOCALE_ORDER)("the shared table (%s)", (locale) => {
  const watching = () => stubNet({ role: "table", live: true, seat: null, status: "live" });

  beforeEach(stubStorageWithBoard);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws no hand at all", () => {
    const { container } = renderWith(raceState(), <App />, locale, 0, watching());
    expect(container.querySelector(".handzone")).toBeNull();
    expect(container.querySelector(".handrow")).toBeNull();
    /* And the board it is there for is drawn. */
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(container.querySelectorAll(".seat")).toHaveLength(4);
  });

  /* Vacuity guard: the same board with no session draws both. */
  it("is the only reason the hand is missing", () => {
    const { container } = renderWith(raceState(), <App />, locale);
    expect(container.querySelector(".handzone")).not.toBeNull();
    expect(container.querySelector(".handrow")).not.toBeNull();
  });

  /* useSpectating() wins over tableHere: the table window itself does not
     change at all, even if it were somehow told a display is in the room. */
  it("still draws the board itself when told a display is here", () => {
    const { container } = renderWith(
      raceState(),
      <App />,
      locale,
      0,
      stubNet({ role: "table", live: true, seat: null, status: "live", tableHere: true }),
    );
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(container.querySelectorAll(".seat")).toHaveLength(4);
    expect(container.querySelector(".private")).toBeNull();
  });

  /* Every panel is one seat's decision, and this window holds none. Read off
     PHASE_PANEL rather than listed again, so a phase that arrives with a panel
     is swept here the moment it is classified up there. */
  const PANEL_PHASES = PHASES.filter((p) => PHASE_PANEL[p]);

  it.each(PANEL_PHASES)("draws no panel in the %s phase", (phase) => {
    const g = loadedState({
      phase,
      declSeq: [0, 1, 2, 3],
      declIdx: 0,
      /* The offer is seat 0's own. A sooli phase with sooliSeat null is a state
         the reducer never builds, and Panels now correctly draws nothing for
         it — which would make the vacuity guard below vacuous. */
      sooliSeat: 0,
      sooliExchange: { gave: card("S", 13), got: card("D", 2) },
    });
    const table = renderWith(g, <Panels />, locale, 0, watching());
    expect(table.container.innerHTML).toBe("");
    table.unmount();
    /* Vacuity guard: the same phase with no session draws one, so the empty
       above is the role and not the fixture. */
    const off = renderWith(g, <Panels />, locale);
    expect(off.container.innerHTML).not.toBe("");
  });

  /* The whole read-only rule, swept rather than spelled: every screen kind,
     every phase, every button on it. SCOPE is imported rather than a list of
     action types written out here — a `flow` action added later is refused by
     this test the day it is drawn on the table. */
  const TABLE_SCREENS: { [K in Screen["kind"]]: Extract<Screen, { kind: K }> } = {
    blindselect: { kind: "blindselect" },
    shop: { kind: "shop" },
    dealend: { kind: "dealend", score: 1400 },
    cashout: {
      kind: "cashout",
      score: 1200,
      reward: 4,
      bonus: 3,
      interest: 2,
      spare: 1,
      bank: 26,
    },
    gameover: { kind: "gameover" },
    victory: { kind: "victory" },
    challengeover: { kind: "challengeover", score: 137 },
    raceover: {
      kind: "raceover",
      winner: 0,
      scores: [RACE_TARGET + 400, 4100],
      deals: 8,
    },
    rpsover: { kind: "rpsover", result: "won", wins: [7, 4] },
  };

  const clickEverything = (container: HTMLElement) => {
    for (const b of [...container.querySelectorAll<HTMLElement>("button")]) fireEvent.click(b);
  };

  const onlyLocal = (dispatch: { mock: { calls: Array<[{ type: keyof typeof SCOPE }]> } }) =>
    dispatch.mock.calls.map(([a]) => a.type).filter((t) => SCOPE[t] !== "local");

  it.each(Object.values(TABLE_SCREENS).map((s) => [s.kind, s] as const))(
    "moves nothing from the %s screen",
    (kind, screen) => {
      /* The shop is the one kind that needs stock, and stock is a wallet's:
         every purse in a race is empty, so it is put there by hand. */
      const g = raceState({ screen, phase: kind === "shop" ? "shop" : "handend" });
      const { container, dispatch } = renderWith(
        kind === "shop" ? withEcon(g, 0, { shop: SHOP }) : g,
        <App />,
        locale,
        0,
        watching(),
      );
      /* Checked before the clicks, not after: one of the buttons swept here is
         the rail's own language switch, and an English sweep that had already
         clicked it would be reading Finnish. */
      check(`the table on ${kind}`, locale, container.textContent ?? "");
      clickEverything(container);
      expect(onlyLocal(dispatch)).toEqual([]);
    },
  );

  /* One control the sweep above can no longer see: `leaveChallenge` is `local`
     now, so `onlyLocal` filters it away. It is the click that hangs the session
     up, and a board on a wall must not offer it — so both result screens are
     asserted by name instead, the button's label and the session's own dispatch
     alike. */
  it.each([
    ["challengeover", TABLE_SCREENS.challengeover],
    ["raceover", TABLE_SCREENS.raceover],
    ["rpsover", TABLE_SCREENS.rpsover],
  ] as const)("offers no way back to a run from the %s screen", (_kind, screen) => {
    /* The screen alone, not the whole App: the banner's own Leave is the
       table's one legitimate way off the table, and it hangs up on purpose. */
    const { container, dispatch, net } = renderWith(
      raceState({ screen, phase: "handend" }),
      <Screens />,
      locale,
      0,
      watching(),
    );
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    expect(labels).not.toContain(translate(locale, "btn.backToRun"));
    /* And it is not told about a button it does not have. */
    expect(container.textContent).not.toContain(translate(locale, "net.leaveHangsUp"));
    clickEverything(container);
    expect(net.hangUp).not.toHaveBeenCalled();
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain("leaveChallenge");
  });

  /* Vacuity guard: the same two screens on a window that holds the chair do
     draw that button and do hang up, so the absence above is the role. */
  it.each([
    ["challengeover", TABLE_SCREENS.challengeover],
    ["raceover", TABLE_SCREENS.raceover],
    ["rpsover", TABLE_SCREENS.rpsover],
  ] as const)("is the only reason the %s screen offers none", (_kind, screen) => {
    const { container, dispatch, net } = renderWith(
      raceState({ screen, phase: "handend" }),
      <Screens />,
      locale,
      0,
      stubNet({ role: "host", live: true, status: "live", seat: 0 }),
    );
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    expect(labels).toContain(translate(locale, "btn.backToRun"));
    expect(container.textContent).toContain(translate(locale, "net.leaveHangsUp"));
    clickEverything(container);
    expect(net.hangUp).toHaveBeenCalled();
    expect(dispatch.mock.calls.map(([a]) => a.type)).toContain("leaveChallenge");
  });

  it.each(PHASES)("moves nothing from the %s phase", (phase) => {
    const { container, dispatch } = renderWith(
      raceState({ phase, screen: null, declSeq: [0, 1, 2, 3], declIdx: 0 }),
      <App />,
      locale,
      0,
      watching(),
    );
    check(`the table in ${phase}`, locale, container.textContent ?? "");
    clickEverything(container);
    expect(onlyLocal(dispatch)).toEqual([]);
  });

  /* Vacuity guard for the phase dimension, and it has to be a click: the felt
     with no screen over it is exactly where a phase's own controls are drawn,
     and on a window that holds the chair those controls do move the game. A
     sweep that found no button at all would pass the assertion above without
     proving anything. */
  it("is the only reason a phase moves nothing", () => {
    const { container, dispatch } = renderWith(
      raceState({ phase: "declare", screen: null, declSeq: [0, 1, 2, 3], declIdx: 0 }),
      <App />,
      locale,
    );
    clickEverything(container);
    expect(onlyLocal(dispatch)).toContain("declare");
  });

  /* The sweep above has no `g.modal` dimension, and every modal is one local
     click away on the table's own rail — the seed chip is an ordinary button
     on purpose, since reading the seed off the shared screen is what it is
     for. Keyed off the Modal union, so a sixth modal fails to type-check
     until it is listed here. `hangup`'s confirm is a `MoveButton`, so a table
     sees only its cancel button — the same shape `restart` already has. */
  const TABLE_MODALS: Record<Modal, true> = {
    rules: true,
    seed: true,
    restart: true,
    scores: true,
    hangup: true,
  };

  it.each(Object.keys(TABLE_MODALS) as Modal[])("moves nothing from the %s modal", (modal) => {
    const { container, dispatch } = renderWith(
      raceState({ modal, phase: "handend", screen: { kind: "dealend", score: 1400 } }),
      <App />,
      locale,
      0,
      watching(),
    );
    check(`the table's ${modal} modal`, locale, container.textContent ?? "");
    clickEverything(container);
    expect(onlyLocal(dispatch)).toEqual([]);
  });

  /* And no `g.menu` dimension either, which is the sharper omission: `g.menu`
     is state, so a sweep keyed off screens alone met the letter of "nothing on
     a table window can move the game" while the menu stood wide open. The route
     that used to put a table there is gone — `leaveChallenge` is `local` now,
     so no numbered action lands a peer on `menu: "start"` any more — and the
     dimension stays as defence in depth: it is keyed off the MenuView union, so
     a fifth view fails to type-check until it is listed here, and a `flow`
     action drawn behind any of them is refused the day it is drawn. */
  const TABLE_MENUS: Record<MenuView, true> = {
    start: true,
    single: true,
    lobby: true,
  };

  it.each(Object.keys(TABLE_MENUS) as MenuView[])("moves nothing from the %s menu", (menu) => {
    const { container, dispatch, net } = renderWith(
      /* runStarted is forced on for the lobby row alone, so the sweep's click
         actually reaches the return button drawn there — every other row has
         no use for it, and forcing it everywhere would change nothing else
         these rows draw. */
      raceState({ menu, phase: "handend", runStarted: menu === "lobby" }),
      <App />,
      locale,
      0,
      watching(),
    );
    check(`the table's ${menu} menu`, locale, container.textContent ?? "");
    clickEverything(container);
    expect(onlyLocal(dispatch)).toEqual([]);
    /* The menu's two lobby doors are `local`, so the dispatch spy says nothing
       about where they lead. What must not be reachable behind them is the
       session itself: `invite` would build a hostSession on a window that is
       still a live guest, and `start` would number a run. Leaving is the one
       thing this window may do, so hangUp is not on the list. */
    for (const method of [
      net.invite,
      net.start,
      net.join,
      net.enterRoom,
      net.openRoom,
      net.setMatch,
      net.connect,
    ])
      expect(method).not.toHaveBeenCalled();
  });

  /* Offline the menu still reaches a run of your own — through Single player,
     which is where every game against the bots is started now. A live window
     never gets there: the door is disabled and refuses in its own handler, and
     a shared table draws no MoveButton at all. */
  it("still allows the offline start menu to begin a solo run", () => {
    const g = raceState({ menu: "start", phase: "handend", runStarted: false });
    const menu = renderWith(g, <App />, locale);
    clickEverything(menu.container);
    /* The menu's own clicks are all local — both doors are showMenu — so the
       vacuity guard has to follow one of them to the button that does move the
       game. */
    const toSingle = menu.dispatch.mock.calls
      .map(([a]) => a)
      .find((a) => a.type === "showMenu" && a.view === "single");
    expect(toSingle).toBeDefined();
    menu.unmount();

    const single = renderWith(gameReducer(g, toSingle!), <App />, locale);
    clickEverything(single.container);
    expect(single.dispatch.mock.calls.map(([a]) => a.type)).toContain("newRun");
    /* And the lobby door is the other half of the same guard: a host's Start
       moves the game through the session rather than through a dispatch. It
       takes a host to reach one — the page before a session exists starts
       nothing at all — so this window is one, with its open chair answered. */
    single.unmount();

    const toLobby = { type: "showMenu", view: "lobby" } as const;
    const hosting = stubNet({
      role: "host",
      live: true,
      seat: 0,
      chairs: OFF_CHAIRS.map((c) =>
        c.seat === 1 ? { ...c, kind: "open" as const, state: "connected" as const } : c,
      ),
    });
    const lobby = renderWith(gameReducer(g, toLobby), <App />, locale, 0, hosting);
    clickEverything(lobby.container);
    expect(hosting.start).toHaveBeenCalled();
  });

  /* A hosted main-game run is out of the mode's scope but not out of its
     reach: `newRun` is a `flow` action, so a host that dispatches one puts
     every peer — the table included — into a run with a wallet. Its rail draws
     the kit page, and every plate on it reads econOf(g, useViewSeat()), so the
     owner's jokers, tricks and tuppipakka cards are on the shared screen. What
     may not be there is a button that spends them. */
  it("moves nothing from a hosted main-game run's rail", () => {
    const { container, dispatch } = renderWith(
      loadedState({ money: 20 }),
      <App />,
      locale,
      0,
      watching(),
    );
    check("the table on a main-game run", locale, container.textContent ?? "");
    clickEverything(container);
    expect(onlyLocal(dispatch)).toEqual([]);
  });

  /* Tupatro's own kit page: a full temppu box on a shared table draws — the
     rail sweep already covers that in both languages — but must not be
     clickable, exactly like the main game's wallet. The chair-holding vacuity
     guard mirrors the one above: a window that holds a chair does see a
     dispatch from the same box. */
  it("moves nothing from a Tupatro rail with a full temppu box", () => {
    const g = tupatroState();
    const { container, dispatch } = renderWith(g, <App />, locale, 0, watching());
    clickEverything(container);
    expect(onlyLocal(dispatch)).toEqual([]);
  });

  it("does dispatch from the same Tupatro box on a window holding a chair", () => {
    const g = tupatroState();
    const { container, dispatch } = renderWith(g, <App />, locale);
    clickEverything(container);
    expect(dispatch.mock.calls.some(([a]) => a.type === "useConsumable")).toBe(true);
  });

  /* The buttons on that rail were fixed and the labels above them were not:
     `Tally` is the main game's only plate that names a side, and "Me" / "He"
     is written from a chair. The sweep below reads it for the four words no
     table window may say; what needs a case of its own is the plate's rows,
     since the four characters are on the felt anyway and a text search cannot
     tell the two apart. */
  it("names both pairs on a hosted main-game run's tally", () => {
    const { container } = renderWith(loadedState({ money: 20 }), <App />, locale, 0, watching());
    expect(tallyLabels(container)).toEqual([
      translate(locale, "race.pair", { a: SEATS[0].name, b: SEATS[2].name }),
      translate(locale, "race.pair", { a: SEATS[1].name, b: SEATS[3].name }),
    ]);
  });

  /* Vacuity guard: the same plate on a window that holds a chair does say
     "Me" and "He", which is what makes the pair names above the role. */
  it("is the only reason the tally names no side", () => {
    const { container } = renderWith(loadedState({ money: 20 }), <App />, locale);
    expect(tallyLabels(container)).toEqual([
      translate(locale, "rail.us"),
      translate(locale, "rail.them"),
    ]);
  });

  /* Vacuity guard: that same rail on a window that holds the chair sells and
     spends, so the silence above is the role and not an empty wallet. */
  it("is the only reason the kit page spends nothing", () => {
    const { container, dispatch } = renderWith(loadedState({ money: 20 }), <App />, locale);
    clickEverything(container);
    const sent = onlyLocal(dispatch);
    for (const type of ["sellJoker", "sellSideCard", "useConsumable"]) expect(sent).toContain(type);
  });

  /* Vacuity guard: the seed dialog does start a run on a window that holds a
     chair, which is what makes its silence on the table the role. */
  it("is the only reason the seed dialog starts nothing", () => {
    const { container, dispatch } = renderWith(raceState({ modal: "seed" }), <App />, locale);
    clickEverything(container);
    expect(onlyLocal(dispatch)).toContain("newRun");
  });

  /* Vacuity guard: the same clicks on a window that holds a chair do move the
     game, so the sweep above is the role and not a screen with no buttons. */
  it("is the only reason nothing moves", () => {
    const { container, dispatch } = renderWith(
      raceState({ phase: "handend", screen: { kind: "dealend", score: 1400 } }),
      <App />,
      locale,
    );
    clickEverything(container);
    expect(onlyLocal(dispatch)).toContain("nextDeal");
  });

  /* No label on this window is written from a viewer's point of view: "Sinä",
     "Te", "Vastustajat", "Me" and "He" all name a side, and a board on a wall
     has none. One sweep over both key sets and every state, rather than one
     sweep per set: the hole that let `rail.us` survive the first version of
     this test was a race-only sweep meeting a rail plate the race never draws,
     and two loops with two key lists would leave the same hole the other way
     up. */
  const MINE: Array<[string, () => GameState]> = [
    ["the felt", () => raceState()],
    ["a declared sooli", () => raceState({ sooli: true, sooliSeat: 1, mode: "nolo" })],
    ["the felt from the other pair's anchor", () => raceState({ ramSeat: 1, ramTeam: 1 })],
    [
      "the deal-end screen",
      () => raceState({ phase: "handend", screen: { kind: "dealend", score: 1400 } }),
    ],
    [
      "the race-over screen",
      () =>
        raceState({
          phase: "handend",
          raceScores: [RACE_TARGET + 400, 4100],
          screen: {
            kind: "raceover",
            winner: 0,
            scores: [RACE_TARGET + 400, 4100],
            deals: 8,
          },
        }),
    ],
    /* A hosted main-game run is the one state that draws `Tally`, and the
       race's five never do. */
    ["a hosted main-game run's rail", () => loadedState({ money: 20 })],
  ];

  it.each(MINE)("says nothing about a side of its own on %s", (label, state) => {
    const { container } = renderWith(state(), <App />, locale, 0, watching());
    const text = container.textContent ?? "";
    for (const key of ["seat.you", "chal.us", "chal.them", "rail.us", "rail.them"] as const) {
      const word = translate(locale, key);
      expect(text, `${label} [${locale}] said "${word}"`).not.toMatch(
        new RegExp(`(^|\\W)${word}(\\W|$)`),
      );
    }
    /* And it names the two pairs by their four characters instead. */
    check(label, locale, text);
  });

  /* The pair names are what replaces us/them, so the rail plate and both race
     screens have to print all four characters. */
  it.each(MINE.filter(([label]) => label !== "a declared sooli"))(
    "names both pairs by their characters on %s",
    (_label, state) => {
      const { container } = renderWith(state(), <App />, locale, 0, watching());
      const text = container.textContent ?? "";
      for (const s of SEATS) expect(text).toContain(s.name);
    },
  );

  /* The reveal is one player's peek at the other hands, so it is not this
     window's: every chair shows a card count instead. With `you` null every
     seat is "not you", so a guard written only on that comparison would print
     all four hands. */
  it("prints no hand when the deal is revealed", () => {
    const g = raceState({ revealTo: 0 });
    /* The whole hand, in the order the reveal sorts it: a single card label is
       also what a card on the felt prints, so the marker has to be the list. */
    const hand = (p: Seat) =>
      g.hands[p]
        .slice()
        .sort((a, b) => rv(g, b) - rv(g, a))
        .map(cardName)
        .join(" ");
    const sub = (c: HTMLElement, p: Seat) =>
      c.querySelectorAll<HTMLElement>(".seat .sub")[p]?.textContent ?? "";

    const table = renderWith(g, <App />, locale, 0, watching());
    for (const p of [0, 1, 2, 3] as Seat[]) {
      expect(table.container.textContent, `printed seat ${p}'s hand`).not.toContain(hand(p));
      /* Every chair shows a count instead, its own included. */
      expect(sub(table.container, p)).toBe(
        translate(locale, "table.cardCount", { n: g.hands[p].length }),
      );
    }
    table.unmount();

    /* Vacuity guard: a window that holds a chair does see them, which is what
       makes the absence above the role and not the fixture. `you` is null
       while spectating, so every seat is "not you" — a guard written on that
       comparison alone would print all four hands. */
    const off = renderWith(g, <App />, locale);
    expect(off.container.textContent).toContain(hand(1));
    off.unmount();

    /* A second seat's own window — one that holds a chair, but not the one
       the peek was armed for — sees nothing either: revealTo === you is the
       whole guard, not merely !spectating. Tupatro can have more than one
       seat holding a temppu, so the peek is one seat's alone. */
    const other = renderWith(g, <App />, locale, 1);
    for (const p of [0, 1, 2, 3] as Seat[])
      expect(other.container.textContent, `seat 1 saw seat ${p}'s hand`).not.toContain(hand(p));
  });

  /* The rail's New game button would raise a menu whose buttons start runs,
     and a table starts nothing. Rules and SCORES stay: somebody at the shared
     screen looking a rule up is what the panel is for. */
  it("draws no New game button and keeps Rules and SCORES", () => {
    const { container } = renderWith(raceState(), <Rail />, locale, 0, watching());
    const labels = [...container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent);
    expect(labels).not.toContain(translate(locale, "btn.menu"));
    expect(labels).toContain(translate(locale, "btn.rules"));
    expect(labels).toContain(translate(locale, "btn.scores"));
  });

  /* The banner says what this window is, and carries the one way off the table
     without a reload. */
  it("says what it is, and leaves", () => {
    const net = watching();
    const { container, dispatch } = renderWith(raceState(), <App />, locale, 0, net);
    const banner = container.querySelector(".netbanner");
    expect(banner?.textContent).toContain(translate(locale, "net.table"));
    /* Not a chair: no character's name is claimed by this window. */
    for (const s of SEATS) expect(banner?.textContent).not.toContain(s.name);

    fireEvent.click(
      [...banner!.querySelectorAll<HTMLElement>("button")].filter(
        (b) => b.textContent === translate(locale, "btn.hangUp"),
      )[0],
    );
    expect(net.hangUp).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view: "start" });
  });
});

/* ==================== the private view ====================
   A chair-holder's own window while a shared table is connected and the board
   is hidden: 2026-09-19-private-table-layout-hand-placement moved the hand
   *inside* .private, in the area .felt normally occupies, rather than leaving
   it in #app's own hand row beneath an otherwise-empty frame. */
describe.each(LOCALE_ORDER)("the private view (%s)", (locale) => {
  const inZone = (over: Partial<Net> = {}) =>
    stubNet({ role: "guest", live: true, seat: 2, status: "live", tableHere: true, ...over });

  beforeEach(stubStorageWithBoard);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the hand inside the zone, not beside the felt", () => {
    const { container } = renderWith(raceState(), <App />, locale, 2, inZone());
    expect(container.querySelectorAll(".handzone")).toHaveLength(1);
    expect(container.querySelector(".private .handzone")).not.toBeNull();
    expect(container.querySelector(".felt")).toBeNull();
    expect(container.querySelector(".seat")).toBeNull();
    expect(container.querySelector(".slot")).toBeNull();
    expect(container.querySelector(".pop")).toBeNull();
  });

  /* Vacuity guard: with no display in the room the hand is back where it
     always was, so the zone above is what moved it, not the fixture. */
  it("is the only reason the hand moves — with no display it stays beside the felt", () => {
    const { container } = renderWith(raceState(), <App />, locale, 2, inZone({ tableHere: false }));
    expect(container.querySelectorAll(".handzone")).toHaveLength(1);
    expect(container.querySelector(".private .handzone")).toBeNull();
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(container.querySelectorAll(".seat")).toHaveLength(4);
  });

  /* Every panel is one seat's decision, swept off PHASE_PANEL rather than
     listed by hand, the same shape the shared table's own sweep uses. */
  const PANEL_PHASES = PHASES.filter((p) => PHASE_PANEL[p]);

  it.each(PANEL_PHASES)(
    "keeps exactly one #declpanel, inside .privstage and never over the hand, in %s",
    (phase) => {
      const g = loadedState({
        phase,
        declSeq: [0, 1, 2, 3],
        declIdx: 0,
        sooliSeat: 0,
        sooliExchange: { gave: card("S", 13), got: card("D", 2) },
      });
      const priv = renderWith(g, <App />, locale, 0, inZone({ seat: 0 }));
      expect(priv.container.querySelectorAll("#declpanel")).toHaveLength(1);
      expect(priv.container.querySelector(".privstage #declpanel")).not.toBeNull();
      expect(priv.container.querySelector("#declpanel .handzone")).toBeNull();
      priv.unmount();

      /* And the full board still draws exactly one too — this never doubles
         up, it only moves. */
      const board = renderWith(g, <App />, locale, 0);
      expect(board.container.querySelectorAll("#declpanel")).toHaveLength(1);
    },
  );

  it("stays playable inside the zone", () => {
    const g = loadedState({ phase: "play", turn: 2 });
    const { container, dispatch } = renderWith(g, <App />, locale, 2, inZone());
    const playable = [...container.querySelectorAll<HTMLElement>(".hcard.playable")];
    expect(playable.length).toBeGreaterThan(0);
    fireEvent.click(playable[0]);
    expect(dispatch).toHaveBeenCalledWith({
      type: "playCard",
      p: 2,
      uid: playable[0].dataset.uid,
    });
  });

  it("toggles between the zone and the board, dispatching nothing either way", () => {
    const { container, dispatch } = renderWith(raceState(), <App />, locale, 2, inZone());
    expect(container.querySelector(".private")).not.toBeNull();

    fireEvent.click(container.querySelector<HTMLElement>(".privbar button")!);
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(container.querySelectorAll(".seat")).toHaveLength(4);
    expect(container.querySelector(".private")).toBeNull();
    expect(container.querySelector(".handzone")).not.toBeNull();

    fireEvent.click(container.querySelector<HTMLElement>(".privbar.float button")!);
    expect(container.querySelector(".felt")).toBeNull();
    expect(container.querySelector(".private .handzone")).not.toBeNull();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("leaves no player-facing text broken", () => {
    const { container } = renderWith(raceState(), <App />, locale, 2, inZone());
    check("the private view", locale, container.textContent ?? "");
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
  const pickerState = (over: StateOver = {}) =>
    loadedState({
      screen: { kind: "shop" },
      shop: REPLACE_SHOP,
      money: 20,
      jokerSlots: 3,
      sideSlots: 2,
      ...over,
    });

  function shop(over: StateOver = {}) {
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
    ["a joker", 0, (g) => econOf(g, 0).jokers],
    ["a trick", 2, (g) => econOf(g, 0).consumables],
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
    expect(rows()).toHaveLength(econOf(g, 0).sideDeck.length);
    rows().forEach((row, i) => {
      const c = econOf(g, 0).sideDeck[i];
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
    expect(dispatch.mock.calls[0][0]).toStrictEqual({ type: "buy", p: 0, index: 0, replace: k });
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
    expect(dispatch.mock.calls[0][0]).toStrictEqual({ type: "buy", p: 0, index: 1 });
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
    expect(rows()).toHaveLength(econOf(before, 0).jokers.length);
    fireEvent.click(rows()[1]);
    expect(rows()[1].classList.contains("selected")).toBe(true);

    fireEvent.click(container.querySelector<HTMLElement>(".restock")!);
    expect(rows()).toHaveLength(econOf(after, 0).sideDeck.length);
    expect(rows().map((r) => r.classList.contains("selected"))).toEqual(
      econOf(after, 0).sideDeck.map(() => false),
    );
    const confirm = [
      ...container.querySelectorAll<HTMLButtonElement>(".replacepick .row button"),
    ].filter((b) => b.textContent === translate(locale, "btn.doReplace"));
    expect(confirm[0].disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

/* ==================== the seat on an economy action ====================
   The wallet is a seat's, and the reducer refuses an economy action whose seat
   is not human — so a dispatch site that left the field out would be silently
   ignored: no toast, no purchase, nothing to see. Each of the five payloads is
   asserted whole. */
describe.each(LOCALE_ORDER)("an economy action carries the acting seat (%s)", (locale) => {
  const rail = () => renderWith(loadedState(), <Rail />, locale);
  const only = (r: ReturnType<typeof rail>) => {
    expect(r.dispatch).toHaveBeenCalledTimes(1);
    return r.dispatch.mock.calls[0][0];
  };
  const click = (r: ReturnType<typeof rail>, sel: string) => {
    const el = r.container.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(`no ${sel} in the rail`);
    fireEvent.click(el);
  };

  it("sends the seat with a joker sale", () => {
    const r = rail();
    click(r, ".jokers .jk .sell");
    expect(only(r)).toStrictEqual({ type: "sellJoker", p: 0, index: 0 });
  });

  it("sends the seat with a tuppipakka card sale", () => {
    const r = rail();
    click(r, ".sidelist .sideitem .sell");
    expect(only(r)).toStrictEqual({ type: "sellSideCard", p: 0, index: 0 });
  });

  it("sends the seat with a trick", () => {
    const r = rail();
    click(r, ".cons .consbtn");
    expect(only(r)).toStrictEqual({ type: "useConsumable", p: 0, index: 0 });
  });

  it("sends the seat with a reroll", () => {
    const g = loadedState({ screen: { kind: "shop" }, phase: "shop", shop: SHOP, money: 50 });
    const r = renderWith(g, <Screens />, locale);
    const btn = [...r.container.querySelectorAll<HTMLButtonElement>(".overlay .row button")].filter(
      (b) => b.textContent === translate(locale, "btn.reroll", { price: 5 }),
    );
    expect(btn).toHaveLength(1);
    fireEvent.click(btn[0]);
    expect(only(r)).toStrictEqual({ type: "reroll", p: 0 });
  });
});

/* The tuppipakka swap is select-then-confirm: a click on a side-deck card
   opens an infobox about it, and only the confirm button spends the swap. The
   selection lives in the panel, so what a test can hold is the wiring — what a
   click dispatches, what the infobox names, and that an unavailable card is
   readable but not confirmable. */
describe.each(LOCALE_ORDER)("the tuppipakka swap panel (%s)", (locale) => {
  function swapPanel(tweak: (g: GameState) => StateOver = () => ({})) {
    const base = loadedState({ phase: "swap" });
    const g = withOver(base, tweak(base));
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
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[0].uid));
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain("pickSideCard");
    expect(container.querySelector("#declpanel .swapinfo")).not.toBeNull();
  });

  it("names and describes the selected card's own enhancement", () => {
    const { g, container, sideCard } = swapPanel();
    const enh = econOf(g, 0).sideDeck[0].enh;
    if (!enh) throw new Error("the fixture's first side-deck card carries no enhancement");
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[0].uid));
    const text = container.querySelector(".swapinfo")?.textContent ?? "";
    expect(text).toContain(nameOfIn(locale, ENH[enh]));
    expect(text).toContain(descOfIn(locale, ENH[enh]));
  });

  /* Pinned to the twin's uid rather than to "a hand card": the swap replaces
     one card and nothing else, and the fixture's first hand card is not it. */
  it("shows both cards of the exchange, the twin included", () => {
    const { g, container, sideCard } = swapPanel();
    const sel = econOf(g, 0).sideDeck[0];
    fireEvent.click(sideCard(sel.uid));
    const cards = [...container.querySelectorAll<HTMLElement>(".swapinfo .card")];
    expect(cards.map((c) => c.dataset.uid)).toEqual([sel.uid, swapTargets(g, 0, sel)[0].uid]);
  });

  it("sends one pickSideCard for the selected card on confirm", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[0].uid));
    fireEvent.click(footerButton(container, "btn.doSwap"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "pickSideCard",
      p: 0,
      uid: econOf(g, 0).sideDeck[0].uid,
    });
    expect(container.querySelector(".swapinfo")).toBeNull();
  });

  it("dispatches nothing when the selection is cancelled", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[0].uid));
    fireEvent.click(footerButton(container, "btn.cancel"));
    expect(container.querySelector(".swapinfo")).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    /* The way out of the phase is back in the footer. */
    expect(footerButton(container, "btn.toDeclaration")).toBeTruthy();
  });

  it("cancels the selection when the selected card is clicked again", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[0].uid));
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[0].uid));
    expect(container.querySelector(".swapinfo")).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("moves the selection to a second card rather than swapping the first", () => {
    const { g, container, dispatch, sideCard } = swapPanel();
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[0].uid));
    fireEvent.click(sideCard(econOf(g, 0).sideDeck[1].uid));
    const cards = [...container.querySelectorAll<HTMLElement>(".swapinfo .card")];
    expect(cards.map((c) => c.dataset.uid)).toEqual([econOf(g, 0).sideDeck[1].uid]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  /* Every reason a card cannot be taken, in the reducer's own guard order.
     The confirm button is clicked rather than only read: disabled that is only
     a class would still fire an onClick. */
  const UNAVAILABLE: Array<
    [
      string,
      number,
      (g: GameState) => StateOver,
      "swap.unavailUsed" | "swap.unavailNoSwaps" | "swap.unavailNoMatch",
    ]
  > = [
    ["its twin went to another seat", 1, () => ({}), "swap.unavailNoMatch"],
    [
      "it has already been swapped in",
      0,
      (g) => ({ usedSide: [econOf(g, 0).sideDeck[0].uid], swapsLeft: econOf(g, 0).swapsLeft - 1 }),
      "swap.unavailUsed",
    ],
    /* sideDeck[0] matches a card in hand, so only the spent swaps stop it. */
    ["the swaps are spent", 0, () => ({ swapsLeft: 0 }), "swap.unavailNoSwaps"],
    /* Both apply at once; the reducer answers "already swapped in" first. */
    [
      "it is both spent and swapped in",
      0,
      (g) => ({ usedSide: [econOf(g, 0).sideDeck[0].uid], swapsLeft: 0 }),
      "swap.unavailUsed",
    ],
  ];

  it.each(UNAVAILABLE)("explains but will not swap a card whose %s", (_why, index, tweak, key) => {
    const { g, container, dispatch, sideCard } = swapPanel(tweak);
    const sel = econOf(g, 0).sideDeck[index];
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
      p: 0,
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

/* Rock-Paper-Scissors' hand is the decision — there is no panel button to
   press — so the card click is the one dispatch site the mode has. */
describe("the Rock-Paper-Scissors hand", () => {
  it("draws the viewing seat's remaining cards and no hand tools", () => {
    const g = rpsState();
    const { container } = renderWith(g, <Hand />, "fi", 0);
    const uids = [...container.querySelectorAll<HTMLElement>(".hcard")].map((c) => c.dataset.uid);
    expect(uids).toEqual(g.hands[0].map((c) => c.uid));
    expect(container.querySelector(".handtools")).toBeNull();
  });

  it("reveals the card that was clicked, by uid", () => {
    const g = rpsState();
    const { container, dispatch } = renderWith(g, <Hand />, "fi", 0);
    const cards = [...container.querySelectorAll<HTMLElement>(".hcard")];
    fireEvent.click(cards[1]);
    expect(dispatch).toHaveBeenCalledWith({ type: "revealRps", p: 0, uid: g.hands[0][1].uid });
  });

  it("reveals nothing once the round has been revealed", () => {
    const { container, dispatch } = renderWith(rpsState({ phase: "rpsreveal" }), <Hand />, "fi", 0);
    for (const c of container.querySelectorAll<HTMLElement>(".hcard")) fireEvent.click(c);
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain("revealRps");
  });

  /* A shared table can never reach this mode, but the click is a dispatch
     site like any other and carries the same guard sooligive's does. */
  it("reveals nothing while spectating", () => {
    const { container, dispatch } = renderWith(
      rpsState(),
      <Hand />,
      "fi",
      0,
      stubNet({ role: "table", live: true, seat: null, status: "live" }),
    );
    for (const c of container.querySelectorAll<HTMLElement>(".hcard")) fireEvent.click(c);
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain("revealRps");
  });

  /* The chip corner would print a number the mode has no use for: it banks
     no scale at all. Every other mode keeps it. */
  it("prints no chip value on a card in this mode", () => {
    const rps = renderWith(rpsState(), <Hand />, "fi", 0);
    expect(rps.container.querySelector(".chip")).toBeNull();
    rps.unmount();
    const main = renderWith(loadedState({ phase: "play", turn: 0 }), <Hand />, "fi", 0);
    expect(main.container.querySelector(".chip")).not.toBeNull();
  });
});

/* The viewing seat is a React context, not a GameState field. The components
   carry no seat literal any more, so the seat the provider holds is the one
   they draw and dispatch for. Single player is 0, which is the default — this
   is what makes the wiring, and not merely its existence, load-bearing. */
describe("the viewing seat comes from the context", () => {
  const state = () => loadedState({ phase: "play", turn: 2 });

  it("draws the seat's own hand and dispatches for it", () => {
    const g = state();
    for (const seat of [0, 1, 2, 3] as const) {
      const { container, dispatch, unmount } = renderWith(
        { ...g, turn: seat },
        <Hand />,
        "fi",
        seat,
      );
      const uids = [...container.querySelectorAll<HTMLElement>(".hcard")].map((c) => c.dataset.uid);
      expect(uids).toEqual(g.hands[seat].map((c) => c.uid));

      const first = container.querySelector<HTMLElement>(".hcard");
      if (first) fireEvent.click(first);
      expect(dispatch).toHaveBeenCalledWith({
        type: "playCard",
        p: seat,
        uid: g.hands[seat][0].uid,
      });
      unmount();
    }
  });

  it("puts the viewing seat at the bottom of the felt", () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const { container, unmount } = renderWith(state(), <Seats />, "fi", seat);
      const south = container.querySelector(".seat-s .av")?.textContent;
      expect(south).toBe(SEATS[seat].short);
      expect(container.querySelector(".seat-s")?.className).toContain("us");
      unmount();
    }
  });

  /* The whole app from a chair that is not 0, which is what the lobby makes
     reachable. Seat 0's chair then belongs to its own character, so a SEATS[0]
     still carrying a "you" key would print nothing there. */
  it.each(LOCALE_ORDER)("draws the whole app from seat 2 in %s", (locale) => {
    const { container } = renderWith(loadedState(), <App />, locale, 2);
    check("the whole app at seat 2", locale, container.textContent ?? "");

    const south = container.querySelector(".seat-s");
    expect(south?.className).toContain("us");
    expect(south?.querySelector(".who")?.textContent).toContain(translate(locale, "seat.you"));
    expect(south?.querySelector(".av")?.textContent).toBe(SEATS[2].short);

    const row0 = [...container.querySelectorAll(".seat")].filter(
      (s) => s.querySelector(".av")?.textContent === SEATS[0].short,
    )[0];
    expect(row0?.querySelector(".who")?.textContent).toContain("Seija");

    /* Exactly one chair is the player's. Two would mean the felt disagrees
       with itself about who is looking. */
    const mine = [...container.querySelectorAll(".seat .who")].filter((w) =>
      (w.textContent ?? "").startsWith(translate(locale, "seat.you")),
    );
    expect(mine).toHaveLength(1);
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

  /* A challenge has no ante, no blind, no target, no money, no jokers, no
     tuppipakka and no consumables, so four of the five pages describe a shell
     that is not there. The page list is built from the state instead. */
  it("draws two pages in a challenge, and none of the shell's plates", () => {
    const { container } = renderWith(laydownState(), <Rail />);
    const pages = [...container.querySelectorAll(".railpage")];
    expect(pages.map((p) => p.className)).toEqual(["railpage rp-challenge", "railpage rp-game"]);
    for (const sel of [".jokers", ".sidelist", ".cons", ".blindplate", ".slate", ".stats"])
      expect(container.querySelector(sel), sel).toBeNull();
    expect(container.querySelector(".rp-challenge .chalplate")).not.toBeNull();
    expect(container.querySelectorAll(".railbtns button")).toHaveLength(3);
  });

  /* A race has no shell either, and it draws its own plate on the same
     two-page strip: the page list is one question for every challenge, the
     plate is the mode's. */
  it("draws the race's own plate on a two-page strip, and none of the shell's", () => {
    const { container } = renderWith(raceState(), <Rail />);
    const pages = [...container.querySelectorAll(".railpage")];
    expect(pages.map((p) => p.className)).toEqual(["railpage rp-challenge", "railpage rp-game"]);
    for (const sel of [".jokers", ".sidelist", ".cons", ".blindplate", ".slate", ".stats"])
      expect(container.querySelector(sel), sel).toBeNull();
    expect(container.querySelector(".rp-challenge .chalplate")).not.toBeNull();
    expect(container.querySelectorAll(".railbtns button")).toHaveLength(3);
  });

  /* The two plates are different views of different modes, so the race's must
     not be the laydown's with the numbers changed. */
  it("draws the deal number, both totals and the target on the race plate", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(raceState(), <Rail />, locale);
      const text = container.querySelector(".chalplate")?.textContent ?? "";
      expect(text).toContain(nameOfIn(locale, CHALLENGES[1]));
      expect(text).toContain(translate(locale, "race.deal", { n: formatNumber(locale, 5) }));
      expect(text).toContain(formatNumber(locale, RACE_TARGET));
      expect(text).toContain(formatNumber(locale, 8200));
      expect(text).toContain(formatNumber(locale, 4100));
      /* Nothing from the laydown: a race has no table to lay out on. */
      expect(text).not.toContain(translate(locale, "chal.laid"));
      unmount();
    }
  });

  /* The plate has to name the mode it draws: the two targets are 12,000 chips
     and 52 points, and a traditional match gets the match plate rather than
     the rummikub one, which reads a blind score a match never banks. */
  it("draws the traditional mode's own name, target and running deal points", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(
        tradState({ mode: "rami", ramTeam: 0, tricks: [9, 4] }),
        <Rail />,
        locale,
      );
      const plate = container.querySelector(".chalplate");
      const text = plate?.textContent ?? "";
      expect(text).toContain(nameOfIn(locale, CHALLENGES[2]));
      expect(text).not.toContain(nameOfIn(locale, CHALLENGES[1]));
      expect(text).toContain(formatNumber(locale, TUPPI_TARGET));
      expect(text).toContain(translate(locale, "matchPlate.dealPoints"));
      /* Nine tricks on a rami this pair declared: (9 - 6) x 4. */
      const row = [...container.querySelectorAll(".chalrowline")].find((l) =>
        l.textContent?.startsWith(translate(locale, "matchPlate.dealPoints")),
      );
      expect(row?.textContent).toContain(formatNumber(locale, 12));
      expect(container.querySelector(".rp-challenge .chalplate")).not.toBeNull();
      expect(container.querySelector(".chalplate")?.textContent).not.toContain(
        translate(locale, "chal.laid"),
      );
      unmount();
    }
  });

  /* A race has the score pop on the felt for per-trick feedback and this mode
     has none at all, which is why only one of them draws the line. */
  it("draws no running deal points on a race plate", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(raceState(), <Rail />, locale);
      expect(container.querySelector(".chalplate")?.textContent).not.toContain(
        translate(locale, "matchPlate.dealPoints"),
      );
      unmount();
    }
  });

  /* Nami has no per-trick score pop either — no scoreTrick means no pop to
     carry — so it draws the running-deal line exactly as the traditional
     match does, negatives included, and it gets the match plate rather than
     the rummikub one (which would draw "chal.laid", a laydown line Nami never
     has). */
  it("draws Nami's own name, target and running deal value, negatives included", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(namiState(), <Rail />, locale);
      const plate = container.querySelector(".chalplate");
      const text = plate?.textContent ?? "";
      expect(text).toContain(
        nameOfIn(
          locale,
          CHALLENGES.find((c) => c.id === "nami")!,
        ),
      );
      expect(text).toContain(formatNumber(locale, NAMI_TARGET));
      expect(text).toContain(translate(locale, "matchPlate.dealPoints"));
      const row = [...container.querySelectorAll(".chalrowline")].find((l) =>
        l.textContent?.startsWith(translate(locale, "matchPlate.dealPoints")),
      );
      /* raceBase[0] is -3 from the viewing seat's opposing pair's angle, but
         the fixture's viewer is team 0, whose own raceBase entry is 7. */
      expect(row?.textContent).toContain(formatNumber(locale, 7));
      expect(container.querySelector(".rp-challenge .chalplate")).not.toBeNull();
      expect(text).not.toContain(translate(locale, "chal.laid"));
      unmount();
    }
  });

  /* The negative side of the same pair's plate, so the sign is not lost
     printing through fmt(). */
  it("draws a negative running deal value on Nami's plate without dropping the sign", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(namiState({ raceBase: [-5, 9] }), <Rail />, locale);
      const row = [...container.querySelectorAll(".chalrowline")].find((l) =>
        l.textContent?.startsWith(translate(locale, "matchPlate.dealPoints")),
      );
      expect(row?.textContent).toContain(formatNumber(locale, -5));
      unmount();
    }
  });

  /* Politiikka gets its own three-page strip, the same shape Tupatro's own
     rp-kit page has: the match plate, a page of its own for the government,
     then the game page. */
  it("draws a three-page strip for Politiikka, with GovBox on its own page", () => {
    const g = politicsState();
    const { container } = renderWith(g, <Rail />);
    const pages = [...container.querySelectorAll(".railpage")];
    expect(pages.map((p) => p.className)).toEqual([
      "railpage rp-challenge",
      "railpage rp-gov",
      "railpage rp-game",
    ]);
    expect(container.querySelector(".rp-challenge .chalplate")).not.toBeNull();
    expect(container.querySelector(".rp-gov .support")).not.toBeNull();
    /* No jokers, no side deck, no consumables — Politiikka's shell is exactly
       as absent as every other match mode's, unlike Tupatro's own third
       page. */
    for (const sel of [".jokers", ".sidelist", ".cons"])
      expect(container.querySelector(sel), sel).toBeNull();
    const gov = governmentFor(g.seed, termOf(g.raceDeal));
    const govText = container.querySelector(".rp-gov")?.textContent ?? "";
    for (const p of PARTIES.filter((p) => gov.includes(p.id))) {
      expect(govText).toContain(nameOfIn("fi", p));
    }
    for (const p of PARTIES.filter((p) => !gov.includes(p.id))) {
      expect(govText).not.toContain(nameOfIn("fi", p));
    }
  });

  it("names the race in place of the ante", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(raceState(), <Rail />, locale);
      expect(container.querySelector(".brand span")?.textContent).toBe(
        nameOfIn(locale, CHALLENGES[1]),
      );
      unmount();
    }
  });

  it("names the challenge in place of the ante", () => {
    for (const locale of LOCALE_ORDER) {
      const { container } = renderWith(laydownState(), <Rail />, locale);
      expect(container.querySelector(".brand span")?.textContent).toBe(
        nameOfIn(locale, CHALLENGES[0]),
      );
      const main = renderWith(loadedState(), <Rail />, locale);
      expect(main.container.querySelector(".brand span")?.textContent).not.toBe(
        nameOfIn(locale, CHALLENGES[0]),
      );
      main.unmount();
    }
  });

  /* PAGES is the page list's length now, so the arrows have to disable at the
     end of a two-page strip as well as a five-page one. */
  it("disables the arrows at the ends of a two-page strip", () => {
    stubScrollIntoView();
    const { container } = renderWith(laydownState(), <Rail />);
    expect(prev(container).disabled).toBe(true);
    expect(next(container).disabled).toBe(false);
    fireEvent.click(next(container));
    expect(next(container).disabled).toBe(true);
    expect(prev(container).disabled).toBe(false);
    fireEvent.click(prev(container));
    expect(prev(container).disabled).toBe(true);
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

/* Nami sets mode to "rami" internally so every mode-reading path has a value,
   but nothing on the felt may say a declaration happened — there is none. */
describe("a Nami deal claims no declaration on the felt", () => {
  it("draws its own label and note instead of RAMI and a declarer's name", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(namiState(), <Table />, locale);
      const box = container.querySelector(".modebox");
      const text = box?.textContent ?? "";
      expect(text).toContain(translate(locale, "table.namiVal"));
      expect(text).toContain(translate(locale, "table.namiNote"));
      expect(text).not.toContain("RAMI");
      expect(text).not.toContain(translate(locale, "table.ramiNote"));
      expect(text).not.toContain(translate(locale, "table.noloNote"));
      unmount();
    }
  });

  it("gives the play line its own hint instead of followWin/lead", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(
        namiState({ phase: "play", turn: 0, trick: [] }),
        <Hand />,
        locale,
      );
      const hint = container.querySelector(".hint")?.textContent ?? "";
      expect(hint).toBe(translate(locale, "hint.namiLead"));
      unmount();
    }
  });

  it("gives the follow line its own hint too, once a card has been led", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(
        namiState({ phase: "play", turn: 0, trick: [{ p: 3, card: card("H", 7) }] }),
        <Hand />,
        locale,
      );
      const hint = container.querySelector(".hint")?.textContent ?? "";
      expect(hint).toBe(
        translate(locale, "hint.namiFollow", { suit: translate(locale, "suit.H") }),
      );
      unmount();
    }
  });
});

/* Every other mode still keeps its chip count; only a Nami deal replaces it
   with the mode's own signed value, negatives and all. */
describe("a Nami card's corner prints the mode's own signed value", () => {
  it("prints the easy table's value, sign included", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(namiState(), <Hand />, locale);
      const ace = [...container.querySelectorAll(".card")].find(
        (el) => el.querySelector(".r")?.textContent === "A",
      );
      expect(ace?.querySelector(".chip")?.textContent).toBe(`+${formatNumber(locale, 4)}`);
      unmount();
    }
  });

  it("prints the hard table's negative ace as a minus, not a plus", () => {
    const { container } = renderWith(namiState({ challenge: "namihard" }), <Hand />);
    const ace = [...container.querySelectorAll(".card")].find(
      (el) => el.querySelector(".r")?.textContent === "A",
    );
    const text = ace?.querySelector(".chip")?.textContent ?? "";
    expect(text).not.toMatch(/^\+/);
    expect(text).toContain("1");
  });
});

/* Politiikka's own deal type is set by the rotation, not a declaration, so
   this box must never call seatName(ramSeat ?? 0, …) — that would name Seija
   as a declarer who does not exist — and the felt has to say the rotation
   decided it rather than reading like an ordinary rami/nolo declaration. */
describe("a Politiikka deal claims no declaration on the felt", () => {
  it("draws the deal's own government/opposition label and note", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(politicsState({ mode: "rami" }), <Table />, locale);
      const box = container.querySelector(".modebox");
      const text = box?.textContent ?? "";
      expect(text).toContain(translate(locale, "table.politicsGov"));
      expect(text).toContain(translate(locale, "table.politicsNote"));
      expect(text).not.toContain("RAMI");
      expect(text).not.toContain(translate(locale, "table.ramiNote"));
      unmount();
    }
  });

  it("draws the opposition label on a nolo deal", () => {
    for (const locale of LOCALE_ORDER) {
      const { container, unmount } = renderWith(politicsState({ mode: "nolo" }), <Table />, locale);
      const box = container.querySelector(".modebox");
      const text = box?.textContent ?? "";
      expect(text).toContain(translate(locale, "table.politicsOpp"));
      expect(text).not.toContain(translate(locale, "table.noloNote"));
      unmount();
    }
  });

  /* Hint is deliberately untouched: g.mode is a real "rami"/"nolo" here, set
     by the rotation rather than a declaration, so the ordinary follow/lead
     lines are already true and stay exactly as they are. */
  it("gives the play line the ordinary follow/lead hint, not a mode-specific one", () => {
    for (const locale of LOCALE_ORDER) {
      const lead = renderWith(
        politicsState({ mode: "rami", phase: "play", turn: 0, trick: [] }),
        <Hand />,
        locale,
      );
      expect(lead.container.querySelector(".hint")?.textContent).toBe(
        translate(locale, "hint.lead"),
      );
      lead.unmount();

      const follow = renderWith(
        politicsState({
          mode: "nolo",
          phase: "play",
          turn: 0,
          trick: [{ p: 3, card: card("H", 7) }],
        }),
        <Hand />,
        locale,
      );
      expect(follow.container.querySelector(".hint")?.textContent).toBe(
        translate(locale, "hint.followDodge", { suit: translate(locale, "suit.H") }),
      );
      follow.unmount();
    }
  });
});

/* The Sofia marker: a text glyph on the ♥Q, only in Politiikka, never
   elsewhere. */
describe("Politiikka's Sofia marker", () => {
  it("marks the ♥Q in a Politiikka deal", () => {
    const c = card("H", 12);
    const { container } = renderWith(
      loadedState({ challenge: "politiikka" }),
      <PlayingCard card={c} />,
    );
    expect(container.querySelector(".sofia")).not.toBeNull();
  });

  it("draws nothing extra for her in any other mode, or for another card in Politiikka", () => {
    for (const challenge of [null, "tuppi", "race", "nami", "rummikub"] as const) {
      const { container, unmount } = renderWith(
        loadedState({ challenge }),
        <PlayingCard card={card("H", 12)} />,
      );
      expect(container.querySelector(".sofia")).toBeNull();
      unmount();
    }
    const { container } = renderWith(
      loadedState({ challenge: "politiikka" }),
      <PlayingCard card={card("S", 12)} />,
    );
    expect(container.querySelector(".sofia")).toBeNull();
  });
});

/* The government emblem marker: the same .pemblem span every mode already
   draws, picked out with an extra class in Politiikka alone — never a new
   glyph, never a suit repaint. Government/opposition membership is looked up
   through the fixture's own seed rather than hardcoded, so the test cannot
   silently agree with a mistake in governmentFor's own ordering. */
describe("Politiikka's government emblem marker", () => {
  const g = loadedState({ challenge: "politiikka" });
  const gov = governmentFor(g.seed, termOf(g.raceDeal));
  const findCard = (inGov: boolean): Card => {
    for (const s of ["S", "H", "D", "C"] as const) {
      for (let r = 2; r <= 14; r++) {
        if (gov.includes(g.partyMap[s + r]) === inGov) return card(s, r);
      }
    }
    throw new Error("no card found");
  };
  const govCard = findCard(true);
  const oppCard = findCard(false);

  it("marks a government party's own emblem", () => {
    const { container } = renderWith(g, <PlayingCard card={govCard} />);
    expect(container.querySelector(".pemblem.govparty")).not.toBeNull();
  });

  it("draws the plain emblem, unmarked, for an opposition party's card", () => {
    const { container } = renderWith(g, <PlayingCard card={oppCard} />);
    expect(container.querySelector(".pemblem")).not.toBeNull();
    expect(container.querySelector(".pemblem.govparty")).toBeNull();
  });

  it("draws nothing extra for the same government party's card in any other mode", () => {
    for (const challenge of [null, "tuppi", "race", "nami", "rummikub"] as const) {
      const { container, unmount } = renderWith(
        loadedState({ challenge }),
        <PlayingCard card={govCard} />,
      );
      expect(container.querySelector(".govparty")).toBeNull();
      unmount();
    }
  });

  /* trad stays exactly "tuppi" | "race" — Politiikka must not gain the
     two-colour deck by way of this marker touching the same class list. */
  it("does not give a Politiikka card the trad class", () => {
    const { container } = renderWith(g, <PlayingCard card={govCard} />);
    expect(container.querySelector(".card")?.classList.contains("trad")).toBe(false);
  });
});
