/* Every shape in one place, read by both the logic and the components — this
   is the layer that heads off the "undefined" class of bug at compile time
   rather than leaving it to the render test. */

import type { SavedRun } from "./save";

export type Suit = "S" | "H" | "D" | "C";
export type Seat = 0 | 1 | 2 | 3;
/* Who sits in a seat. The clock plays the "ai" seats and waits for the
   "human" ones; nothing else in the engine distinguishes them. */
export type SeatKind = "human" | "ai";
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
  /* The team being scored, and the two seats it is made of. A joker that
     names a seat reads them from here, so content.ts holds no seat literal
     and the table stays seat-absolute. */
  team: 0 | 1;
  owner: Seat;
  partner: Seat;
  /* Tricks this team had taken before this one. Team-indexed, not "ours": the
     other team's count is g.tricks[1 - team] for any joker that wants it, and
     is not precomputed here because none does. */
  wonBefore: number;
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

/* An alternate rule set the player opts into. Not a modifier on a run: a
   challenge replaces the roguelike shell outright.

   Three of them now, and they share only the shell's absence: rummikub is four
   forced-rami deals ending in a laydown, and the two *match* modes are
   ordinary tuppi played deal after deal until a pair reaches a target. `deals`
   is inert for both of those, which have no fixed length, and `target` is
   inert for rummikub, which has no target — both fields are data on the row so
   startChallenge reads them rather than testing the id. Every rule branch in
   the reducer does test the id, never the field for truth — an invariant holds
   that line. */
export type MatchId = "race" | "tuppi";
export type ChallengeId = "rummikub" | MatchId;
export type Challenge = { id: ChallengeId; key: string; g: string; deals: number; target: number };

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
  | { kind: "challengeover"; score: number }
  /* The race's end: a pair reached the target and the other was put tuppeen.
     Both totals ride on the payload because the screen reports the match, not
     the run owner's half of it. */
  | { kind: "raceover"; winner: 0 | 1; scores: [number, number]; deals: number };

export type Modal = "rules" | "seed" | "restart" | "scores";

/* The start menu, and the four other views reached from it. A third view
   field rather than a Screen kind or a Modal: a Screen kind would overwrite
   the resumed run's own screen, so Continue would have nowhere to put the
   player back, and a Modal would be closed by the rules panel's own close
   button, dropping them into a run they never chose. "multi" is the one door
   the start menu offers to playing with other people; "lobby" is the room a
   hosted game is set up in behind it — the run it starts does not exist until
   Start is clicked — and "join" is the same room entered from the other side.
   The lobby stays two views rather than one flag inside the component, so a
   link with an invitation in it can land straight on the guest's half. */
export type MenuView = "start" | "challenges" | "multi" | "lobby" | "join";

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

/* ==================== a seat's roguelike shell ====================
   The wallet, the inventory and the shop are a *seat's*, not the run's. Every
   pure function that needs one takes the seat whose wallet it is and resolves
   it through econOf — see economy.ts for why there is deliberately no helper
   that resolves a wallet from whoever is looking. */
export type PlayerEconomy = {
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

  shop: ShopItem[] | null;
  shopAfterBoss: boolean;
  rerollCost: number;
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

  /* One wallet per seat, seat-absolute like the rest of the state: the run
     owner's holds the shell today and the other three are empty. */
  economies: [PlayerEconomy, PlayerEconomy, PlayerEconomy, PlayerEconomy];

  /* Who sits where. Single player is the human at seat 0 and the AI in the
     other three; nothing in the engine assumes that, and the clock reads this
     rather than testing for seat 0. */
  seats: [SeatKind, SeatKind, SeatKind, SeatKind];

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
  /* The seat the sooli was offered to, and so the one playing alone. Set when
     the declaration ends and read for the whole deal: the bust test, the
     partner's sit-out and the trailing seat of sooliOrder are all this seat. */
  sooliSeat: Seat | null;
  sooliOrder: Seat[] | null;
  sooliBust: boolean;
  /* The sooli card exchange is a visible step, not an automatic choice. */
  sooliExchange: { gave: Card; got: Card } | null;

  /* Tricks taken, indexed by team (teamOf), not by "us" and "them". */
  tricks: [number, number];
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

  /* ==================== the match modes ====================
     Inert unless `challenge` is a MatchId — "race" or "tuppi". Both share
     these three and the `race` prefix they were named under, because the two
     modes differ only in the arithmetic that fills them. The match target
     rides in the ordinary `target`; these three are what the shell has no
     field for. `raceDeal` exists to be displayed and sorted on — `dealsLeft`
     counts nothing in a mode with no fixed length. `raceBase` is the deal's
     unmultiplied chips for each pair, the two-sided `base`, and stays [0, 0]
     in a traditional match, whose tricks are worth no chips at all;
     `raceScores` is the match total in whichever scale the mode banks. */
  raceDeal: number;
  raceBase: [number, number];
  raceScores: [number, number];

  trickNo: number;
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
