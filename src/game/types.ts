/* Every shape in one place, read by both the logic and the components — this
   is the layer that heads off the "undefined" class of bug at compile time
   rather than leaving it to the render test. */

import type { SavedRun } from "./save";

export type Suit = "S" | "H" | "D" | "C";
export type Seat = 0 | 1 | 2 | 3;
export type Mode = "rami" | "nolo";
export type SortMode = "suit" | "rank";

export type Enhancement = "stone" | "wild" | "steel" | "glass" | "bonus" | "mult" | "gold";

export type Phase =
  | "blindselect"
  | "swap"
  | "declare"
  | "soolioffer"
  | "sooligive"
  | "sooliready"
  | "play"
  | "resolve"
  | "trickend"
  | "laydown"
  | "handend"
  | "shop";

/* id = the card type ("S14"), uid = the individual. The side deck can bring in
   a duplicate, so every identity comparison uses uid. */
export type Card = {
  s: Suit;
  r: number;
  id: string;
  uid: string;
  enh: Enhancement | null;
  /* The side deck's original card: a glass card can break permanently. */
  srcUid?: string;
};

export type TrickPlay = { p: Seat; card: Card };

export type Show = { decl: Mode; card: Card | null };

export type TrickTypeId =
  "high" | "pair" | "flush" | "twopair" | "straight" | "trips" | "sf" | "quad";

export type TrickType = { id: TrickTypeId; chips: number; mult: number };

/* Jokers read game state only through this context, which is what keeps
   content.ts pure data with no reach into the state. */
export type ScoreContext = {
  cards: Card[];
  winner: Seat;
  lead: Seat;
  type: TrickType;
  mode: Mode | null;
  robbery: boolean;
  usBefore: number;
  themBefore: number;
  scoredBefore: number;
  chips: number;
  mult: number;
  money: number;
  sideDeckEnh: number;
  payout: number;
  steel: number;
  times: number;
  total: number;
};

export type Rarity = "yleinen" | "harvinainen" | "eepos";

export type Joker = {
  id: string;
  key: string;
  g: string;
  p: number;
  r: Rarity;
  mode?: Mode;
  tuppi?: number;
  add?: (c: ScoreContext) => void;
  xm?: (c: ScoreContext) => number;
  retrig?: (c: ScoreContext) => number;
  won?: (c: ScoreContext) => void;
};

export type EnhInfo = { key: string; g: string; p: number };
export type Consumable = { id: string; key: string; g: string; p: number };
export type Voucher = { id: string; key: string; g: string; p: number };
export type Boss = { id: string; key: string };

/* A party. Not a shop row, so it carries no price, and no emblem either: the
   emblem abbreviates the party's *name*, which is translated, so it is
   player-facing text and lives in the catalogue as `party.<id>.g`. The other
   tables keep their `g` because those are language-neutral symbols. */
export type Party = { id: string; key: string };

/* An alternate rule set the player opts into from a list of its own. Not a
   modifier on a run: a challenge replaces the roguelike shell outright, which
   is why `deals` is the whole of its shape — no ante ladder, no blind table
   and no target to carry. */
export type ChallengeId = "rummikub";
export type Challenge = { id: ChallengeId; key: string; g: string; deals: number };

/* A shop card offer. The rank and suit are appended to the name only at
   display time, so the catalogue holds just the enhancement's name. */
export type CardOffer = {
  id: string;
  key: string;
  g: string;
  p: number;
  cardLabel?: string;
  card: { s: Suit; r: number; enh: Enhancement };
};

export type ShopItem =
  | { kind: "joker"; data: Joker; price: number; sold: boolean }
  | { kind: "card"; data: CardOffer; price: number; sold: boolean }
  | { kind: "consumable"; data: Consumable; price: number; sold: boolean }
  | { kind: "voucher"; data: Voucher; price: number; sold: boolean };

/* Flow-driven views. The ones the player opens themselves (rules, seed,
   scores) live in `modal` instead, because they return to whatever view was
   underneath. */
export type Screen =
  | { kind: "blindselect" }
  | { kind: "shop" }
  | { kind: "dealend"; score: number }
  | {
      kind: "cashout";
      score: number;
      reward: number;
      bonus: number;
      interest: number;
      spare: number;
      bank: number;
    }
  | { kind: "gameover" }
  | { kind: "victory" }
  /* A challenge run has no ante to report and no cash-out: the run's total is
     the whole result, and it goes on a board of its own. */
  | { kind: "challengeover"; score: number };

export type Modal = "rules" | "seed" | "restart" | "scores";

/* The start menu, and the only other view reached from it. A third view field
   rather than a Screen kind or a Modal: a Screen kind would overwrite the
   resumed run's own screen, so Continue would have nowhere to put the player
   back, and a Modal would be closed by the rules panel's own close button,
   dropping them into a run they never chose. */
export type MenuView = "start" | "challenges";

/* Toasts are carried as a key, not a finished sentence: the reducer does not
   know the language. `suit` is translated separately into the partitive,
   because the Finnish follow-suit sentence inflects. */
export type Toast = {
  id: number;
  key: string;
  vars?: Record<string, string | number>;
  /* The suit is translated into the partitive separately (the Finnish sentence
     inflects). */
  suit?: Suit;
  /* Datataulukon rivin avain, josta komponentti hakee nimen nameOf:lla. */
  nameKey?: string;
};

/* A trick's score breakdown, for display. Deliberately thin: the view does not
   need the cards, and the whole scoring context does not belong in the state. */
export type Pop = {
  typeId: TrickTypeId;
  chips: number;
  mult: number;
  times: number;
  total: number;
  dodged: boolean;
};

export type GameState = {
  seed: string;
  /* The generator's state belongs to the game state, not to a module
     variable: the reducer has to be pure, and React's StrictMode calls it
     twice in development. */
  rngState: number;
  uidSeq: number;
  /* Card type id ("S14") -> party id. Rolled once per run from the seed and
     then fixed: a mapping that moved between deals would be unreadable, and a
     global one would be free information. */
  partyMap: Record<string, string>;
  /* Party id -> support collected this run. A counter only: nothing reads it
     back into the score, and startDeal deliberately leaves it alone. */
  support: Record<string, number>;

  ante: number;
  blindIdx: number;
  money: number;

  jokers: Joker[];
  consumables: Consumable[];
  vouchers: string[];
  jokerSlots: number;
  consSlots: number;
  shopSlots: number;
  chipBonus: number;
  tuppiBonus: number;

  sideDeck: Card[];
  sideSlots: number;
  swaps: number;
  swapsLeft: number;
  usedSide: string[];

  /* One flag per blind of the ante: small, big, small boss, big boss. */
  beaten: [boolean, boolean, boolean, boolean];
  dealer: Seat;
  phase: Phase;

  hands: [Card[], Card[], Card[], Card[]];
  trick: TrickPlay[];
  leader: Seat;
  turn: Seat;

  mode: Mode | null;
  ramSeat: Seat | null;
  ramTeam: 0 | 1 | null;
  shows: [Show | null, Show | null, Show | null, Show | null];
  declSeq: Seat[];
  declIdx: number;

  sooli: boolean;
  sooliOrder: Seat[] | null;
  sooliBust: boolean;
  /* The sooli card exchange is a visible step, not an automatic choice. */
  sooliExchange: { gave: Card; got: Card } | null;

  usTricks: number;
  themTricks: number;
  scored: number;
  base: number;
  target: number;

  deals: number;
  /* What this blind allotted: `deals`, or one fewer under the Kiire boss. The
     run-level allowance stays in `deals`; only this moves. */
  blindDeals: number;
  dealsLeft: number;
  blindScore: number;
  /* The score of the deal that just ended, so the result screen can report it. */
  handScore: number;
  /* Every blind score the run has banked at cash-out. Nothing reads it back
     into the game: it exists so a finished run can be put on the scoreboard. */
  runScore: number;

  boss: Boss | null;
  reveal: boolean;
  steal: boolean;

  sortMode: SortMode;
  customOrder: boolean;

  /* ==================== the challenge ====================
     null in a main-game run, and every field below is then inert. A challenge
     is not saved, so none of this reaches the snapshot except `parked`, which
     is dropped by name in save.ts so a snapshot can never nest. */
  challenge: ChallengeId | null;
  /* The laydown's table: rows of sets and runs, rearrangeable in place. */
  table: Card[][];
  /* One hand per partnership, not per seat: tuppi collects tricks by pair. */
  layHands: [Card[], Card[]];
  layTurn: 0 | 1;
  layNo: number;
  /* Consecutive passes. Two in a row means neither side can place. */
  layPassed: number;
  layScores: [number, number];
  /* The main run, parked whole while a challenge is played, so leaving one
     gives the run back exactly — mid-deal included. */
  parked: SavedRun | null;

  trickNo: number;
  shop: ShopItem[] | null;
  shopAfterBoss: boolean;
  rerollCost: number;
  winSeat: Seat | null;

  screen: Screen | null;
  modal: Modal | null;
  menu: MenuView | null;
  /* Whether there is a run to go back to, which is what puts Continue on the
     menu. Not "a save exists": a run started this session stays continuable
     where storage throws, and a save the boot rehydrate rejected can never
     offer a Continue that leads nowhere. */
  runStarted: boolean;
  toast: Toast | null;
  toastSeq: number;
  /* The last scored trick's breakdown — the "pop" that rises over the trick. */
  pop: Pop | null;
  bestAnte: number;
};
