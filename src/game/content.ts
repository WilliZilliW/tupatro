import { isStone, isWild } from "./cards";
import {
  NAMI_HARD_TARGET,
  NAMI_TARGET,
  POLITIIKKA_TARGET,
  RACE_TARGET,
  RPS_ROUNDS,
  TUPPI_TARGET,
} from "./constants";
import type {
  Boss,
  Challenge,
  Consumable,
  EnhInfo,
  Enhancement,
  Joker,
  Party,
  PxEventId,
  PxGroup,
  PxTactic,
  Voucher,
} from "./types";

/* The content tables are data, not logic: adding a joker is one entry and no
   engine change. Adding an enhancement or a boss is not — see CLAUDE.md. */

/* mode: "rami" | "nolo" | puuttuu (= molemmissa) */
// prettier-ignore
export const JOKERS: Joker[] = [
  {id:"ramikone", key:"joker.ramikone", g:"↑", p:5, r:"yleinen", mode:"rami", add:c => { if (c.mode === "rami") c.mult += 6; }},
  {id:"nolomestari", key:"joker.nolomestari", g:"↓", p:5, r:"yleinen", mode:"nolo", add:c => { if (c.mode === "nolo") c.mult += 6; }},
  {id:"roskakuski", key:"joker.roskakuski", g:"▼", p:5, r:"yleinen", mode:"nolo",
   add:c => { if (c.mode === "nolo") c.chips += 30 * c.cards.filter(x => x.r >= 11 && x.r <= 13).length; }},
  {id:"herttaherra", key:"joker.herttaherra", g:"♥", p:5, r:"yleinen",
   add:c => { c.chips += 25 * c.cards.filter(x => x.s === "H").length; }},
  {id:"patapaa", key:"joker.patapaa", g:"♠", p:5, r:"yleinen",
   add:c => { c.chips += 25 * c.cards.filter(x => x.s === "S").length; }},
  {id:"kuvakauppias", key:"joker.kuvakauppias", g:"K", p:5, r:"yleinen",
   add:c => { c.chips += 20 * c.cards.filter(x => x.r >= 11 && x.r <= 13).length; }},
  {id:"variveikko", key:"joker.variveikko", g:"♦", p:6, r:"yleinen",
   add:c => { if (c.type.id === "flush" || c.type.id === "sf") c.chips += 70; }},
  {id:"kaveri", key:"joker.kaveri", g:"V", p:5, r:"yleinen", add:c => { if (c.winner === c.partner) c.mult += 5; }},
  {id:"etukasi", key:"joker.etukasi", g:"→", p:5, r:"yleinen", add:c => { if (c.lead === c.owner) c.mult += 5; }},
  {id:"ylitikki", key:"joker.ylitikki", g:"▲", p:7, r:"harvinainen", mode:"rami",
   add:c => { c.mult += 4 * c.wonBefore; }},
  {id:"vyory", key:"joker.vyory", g:"≡", p:6, r:"harvinainen",
   add:c => { c.chips += 25 + 25 * c.scoredBefore; }},
  {id:"assa", key:"joker.assa", g:"A", p:7, r:"harvinainen",
   xm:c => c.cards.some(x => x.r === 14) ? 2 : 1},
  {id:"pikkurilli", key:"joker.pikkurilli", g:"2", p:6, r:"harvinainen",
   add:c => { if (Math.max(...c.cards.map(x => x.r)) <= 9) c.chips += 90; }},
  {id:"nelisuunta", key:"joker.nelisuunta", g:"◆", p:7, r:"harvinainen",
   xm:c => new Set(c.cards.map(x => x.s)).size === c.cards.length ? 2 : 1},
  {id:"ahne", key:"joker.ahne", g:"$", p:6, r:"harvinainen",
   add:c => { c.mult += Math.min(12, Math.floor(c.money / 4)); }},
  {id:"kahvitauko", key:"joker.kahvitauko", g:"☕", p:7, r:"harvinainen",
   add:c => { c.mult += 2; }, won:c => { c.payout += 1; }},
  {id:"ryostaja", key:"joker.ryostaja", g:"▶", p:9, r:"eepos", mode:"rami",
   xm:c => c.robbery ? 2 : 1},
  {id:"tuppisuu", key:"joker.tuppisuu", g:"Ø", p:9, r:"eepos", mode:"nolo",
   xm:c => (c.mode === "nolo" && c.wonBefore === 0) ? 3 : 1},
  {id:"kaksoiskaveri", key:"joker.kaksoiskaveri", g:"2×", p:9, r:"eepos",
   retrig:c => (c.winner === c.partner || c.lead === c.partner) ? 1 : 0},
  {id:"vanhatuppi", key:"joker.vanhatuppi", g:"★", p:10, r:"eepos", tuppi:1},
  {id:"kivenveistaja", key:"joker.kivenveistaja", g:"◼", p:7, r:"harvinainen",
   add:c => { c.chips += 70 * c.cards.filter(isStone).length; }},
  {id:"villimies", key:"joker.villimies", g:"✦", p:8, r:"harvinainen",
   xm:c => c.cards.some(isWild) ? 2 : 1},
  {id:"pakkamestari", key:"joker.pakkamestari", g:"▤", p:9, r:"eepos",
   xm:c => 1 + 0.2 * c.sideDeckEnh}
];

/* Card enhancements. The two best ones do not add numbers, they bend tuppi's
   rules: a stone card has no suit (it sidesteps the follow-suit obligation) and
   no rank (it can never win a trick), and a wild card counts as every suit. */
// prettier-ignore
export const ENH: Record<Enhancement, EnhInfo> = {
  stone:{key:"enh.stone", g:"◼", p:8},
  wild: {key:"enh.wild",  g:"✦", p:7},
  steel:{key:"enh.steel", g:"▮", p:7},
  glass:{key:"enh.glass", g:"◇", p:6},
  bonus:{key:"enh.bonus", g:"+", p:5},
  mult: {key:"enh.mult",  g:"!", p:5},
  gold: {key:"enh.gold",  g:"$", p:5}
};

export const ENH_KEYS = Object.keys(ENH) as Enhancement[];

/* The parties. Thirteen of them, because the deck has to split evenly over
   both the 52 cards and the 13 cards of a suit — only 1 and 13 divide both, so
   thirteen parties of four cards, one per suit, is the single arrangement that
   works. Every name is invented: a real party would be putting words in a real
   organisation's mouth. The emblem is not here: it abbreviates the translated
   name, so it is player-facing text and lives in the catalogue. */
// prettier-ignore
export const PARTIES: Party[] = [
  {id:"kahvi",   key:"party.kahvi"},
  {id:"sauna",   key:"party.sauna"},
  {id:"mokki",   key:"party.mokki"},
  {id:"pilkki",  key:"party.pilkki"},
  {id:"halko",   key:"party.halko"},
  {id:"terva",   key:"party.terva"},
  {id:"suo",     key:"party.suo"},
  {id:"hanki",   key:"party.hanki"},
  {id:"lakka",   key:"party.lakka"},
  {id:"nuotio",  key:"party.nuotio"},
  {id:"laituri", key:"party.laituri"},
  {id:"kelo",    key:"party.kelo"},
  {id:"sumu",    key:"party.sumu"}
];

export const PARTY_IDS = PARTIES.map((p) => p.id);

// prettier-ignore
export const CONSUMABLES: Consumable[] = [
  {id:"kannanvaihto", key:"cons.kannanvaihto", g:"↕", p:5},
  {id:"kurkistus", key:"cons.kurkistus", g:"◉", p:3},
  {id:"vaihtokauppa", key:"cons.vaihtokauppa", g:"↔", p:5},
  {id:"uusijako", key:"cons.uusijako", g:"↻", p:4},
  {id:"tikkivarkaus", key:"cons.tikkivarkaus", g:"»", p:6}
];

// prettier-ignore
export const VOUCHERS: Voucher[] = [
  {id:"teroitin", key:"voucher.teroitin", g:"+", p:7},
  {id:"tuppisormus", key:"voucher.tuppisormus", g:"○", p:10},
  {id:"kahvipannu", key:"voucher.kahvipannu", g:"J", p:8},
  {id:"muistikirja", key:"voucher.muistikirja", g:"M", p:8},
  {id:"hihalaukku", key:"voucher.hihalaukku", g:"▽", p:9},
  {id:"isompipakka", key:"voucher.isompipakka", g:"▤", p:7}
];

/* Two pools, one per boss blind: the small boss is a nuisance, the big one
   costs a blind's plan. BOSSES stays the whole table, because save.ts looks a
   boss up by id and the catalogue test walks one list. */
// prettier-ignore
export const SMALL_BOSSES: Boss[] = [
  {id:"kitsas", key:"boss.kitsas"},
  {id:"pakkorami", key:"boss.pakkorami"},
  {id:"pakkonolo", key:"boss.pakkonolo"},
  {id:"patakielto", key:"boss.patakielto"},
  {id:"kuvakato", key:"boss.kuvakato"},
  {id:"verokarhu", key:"boss.verokarhu"}
];

// prettier-ignore
export const BIG_BOSSES: Boss[] = [
  {id:"punainen", key:"boss.punainen"},
  {id:"kasijarru", key:"boss.kasijarru"},
  {id:"umpimahka", key:"boss.umpimahka"},
  {id:"kiire", key:"boss.kiire"},
  {id:"harmaus", key:"boss.harmaus"},
  /* The consumables are Balatro's shell, not tuppi: neither the Oulunsalo club
     rule sheet nor korttipeliopas.fi knows of a one-shot item a player spends
     mid-deal. Shutting them therefore takes nothing away from the Finnish game
     — every card, every follow-suit obligation and every point in this boss's
     blind is played by exactly the rules of those sources, which is why the
     boss lives here and in one reducer guard rather than near rules.ts. */
  {id:"temppukielto", key:"boss.temppukielto"}
];

export const BOSSES: Boss[] = [...SMALL_BOSSES, ...BIG_BOSSES];

/* The alternate rule sets. The list is what the game layer knows about a
   challenge; everything else is the branch that reads its id — laydown.ts for
   Tuppi-Rummikub, race.ts for the race, points.ts for the traditional match.
   `deals` is inert for the two match modes, which run until a pair reaches the
   target and so have no fixed length, and `target` is inert for Tuppi-Rummikub,
   which has none. Both are on the row so startChallenge can read them straight
   across instead of testing the id. */
// prettier-ignore
export const CHALLENGES: Challenge[] = [
  {id:"rummikub", key:"challenge.rummikub", g:"▦", deals:4, target:0},
  {id:"race",     key:"challenge.race",     g:"→", deals:0, target:RACE_TARGET},
  {id:"tuppi",    key:"challenge.tuppi",    g:"♠", deals:0, target:TUPPI_TARGET},
  {id:"tupatro",  key:"challenge.tupatro",  g:"♣", deals:0, target:TUPPI_TARGET},
  {id:"nami",     key:"challenge.nami",     g:"N", deals:0, target:NAMI_TARGET},
  {id:"namihard", key:"challenge.namihard", g:"H", deals:0, target:NAMI_HARD_TARGET},
  /* target counts *rounds* here, not points: the match is exactly RPS_ROUNDS
     of them and banks no scale at all. */
  {id:"rps",      key:"challenge.rps",      g:"◆", deals:0, target:RPS_ROUNDS},
  {id:"politiikka", key:"challenge.politiikka", g:"P", deals:0, target:POLITIIKKA_TARGET},
  {id:"politix",  key:"challenge.politix",  g:"X", deals:0, target:0}
];

/* ============================ Politix data ============================
   Everything here except a handful of figures is this game's own: the sheet
   (Tahkokallio / Onni Games 2009) gives no card list, no deck counts, no
   politician's skills and only two voter groups' needs. Constraints, all
   tested in politix.test.ts: each group's four needs are a permutation of
   2..5; every tactic is the cheapest (2) somewhere; blondes need 3 charm and
   youth 3 growl (the sheet's two stated figures); a politician's skills lie
   in 0..2 and sum to exactly 3. Pure data, no functions. */
export const PX_TACTICS_LIST: PxTactic[] = ["argue", "evade", "charm", "growl"];
export const PX_GROUP_IDS: PxGroup[] = [
  "farmers",
  "workers",
  "whitecollar",
  "youth",
  "blondes",
  "hippies",
];

// prettier-ignore
export const PX_GROUP_NEED: Record<PxGroup, Record<PxTactic, number>> = {
  farmers:     { argue: 2, evade: 4, charm: 5, growl: 3 },
  workers:     { argue: 3, evade: 5, charm: 4, growl: 2 },
  whitecollar: { argue: 4, evade: 2, charm: 3, growl: 5 },
  youth:       { argue: 5, evade: 4, charm: 2, growl: 3 },
  blondes:     { argue: 5, evade: 2, charm: 3, growl: 4 },
  hippies:     { argue: 4, evade: 3, charm: 5, growl: 2 },
};

/* Skills in PX_TACTICS_LIST order: argue, evade, charm, growl. */
// prettier-ignore
export const PX_POLITICIANS: { id: string; key: string; skills: [number, number, number, number] }[] = [
  { id: "orator",    key: "px.pol.orator",    skills: [2, 1, 0, 0] },
  { id: "slippery",  key: "px.pol.slippery",  skills: [0, 2, 1, 0] },
  { id: "smiler",    key: "px.pol.smiler",    skills: [0, 0, 2, 1] },
  { id: "bulldog",   key: "px.pol.bulldog",   skills: [1, 0, 0, 2] },
  { id: "allrounder", key: "px.pol.allrounder", skills: [1, 1, 1, 0] },
  { id: "charmer",   key: "px.pol.charmer",   skills: [0, 1, 1, 1] },
  { id: "veteran",   key: "px.pol.veteran",   skills: [1, 0, 1, 1] },
  { id: "debater",   key: "px.pol.debater",   skills: [2, 0, 0, 1] },
];

/* Each event moves exactly one tactic by one for everybody. Only the
   recession (+1 growl) is the sheet's own (p. 4). */
export const PX_EVENTS: { id: PxEventId; key: string; tactic: PxTactic; delta: number }[] = [
  { id: "recession", key: "px.event.recession", tactic: "growl", delta: 1 },
  { id: "factcheck", key: "px.event.factcheck", tactic: "argue", delta: 1 },
  { id: "sunshine", key: "px.event.sunshine", tactic: "evade", delta: -1 },
  { id: "tabloid", key: "px.event.tabloid", tactic: "charm", delta: -1 },
];

/* Each party's permanent, unremovable +1 toward one group (the sheet says a
   symbol can give a bonus but not which), indexed by team. */
export const PX_PARTY_BONUS: PxGroup[] = ["whitecollar", "workers"];

/* The 60-card action deck: 9 of each tactic, 6 coffees (wild), one +1 and one
   -1 modifier per group (12), 3 burnouts, 3 yesterday's news. */
export const PX_ACTION_DECK: {
  kind: "tactic" | "coffee" | "mod" | "burnout" | "news";
  tactic: PxTactic | null;
  group: PxGroup | null;
  delta: number;
  n: number;
}[] = [
  ...PX_TACTICS_LIST.map((tactic) => ({
    kind: "tactic" as const,
    tactic,
    group: null,
    delta: 0,
    n: 9,
  })),
  { kind: "coffee", tactic: null, group: null, delta: 0, n: 6 },
  ...PX_GROUP_IDS.flatMap((group) => [
    { kind: "mod" as const, tactic: null, group, delta: 1, n: 1 },
    { kind: "mod" as const, tactic: null, group, delta: -1, n: 1 },
  ]),
  { kind: "burnout", tactic: null, group: null, delta: 0, n: 3 },
  { kind: "news", tactic: null, group: null, delta: 0, n: 3 },
];
