/* Every shape in one place, read by both the logic and the components — this
   is the layer that heads off the "undefined" class of bug at compile time
   rather than leaving it to the render test. */

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

/* Flow-driven views. The ones the player opens themselves (rules, seed) live
   in `modal` instead, because they return to whatever view was underneath. */
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
  | { kind: "victory" };

export type Modal = "rules" | "seed" | "restart";

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
  swapPick: Card | null;
  usedSide: string[];

  beaten: [boolean, boolean, boolean];
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

  trickNo: number;
  shop: ShopItem[] | null;
  shopAfterBoss: boolean;
  rerollCost: number;
  winSeat: Seat | null;

  screen: Screen | null;
  modal: Modal | null;
  toast: Toast | null;
  toastSeq: number;
  /* The last scored trick's breakdown — the "pop" that rises over the trick. */
  pop: Pop | null;
  bestAnte: number;
};
