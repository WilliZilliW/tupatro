import { isStone, isWild } from "./cards.js";

/* mode: "rami" | "nolo" | null (= molemmissa) */
// prettier-ignore
export const JOKERS = [
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
  {id:"kaveri", key:"joker.kaveri", g:"V", p:5, r:"yleinen", add:c => { if (c.winner === 2) c.mult += 5; }},
  {id:"etukasi", key:"joker.etukasi", g:"→", p:5, r:"yleinen", add:c => { if (c.lead === 0) c.mult += 5; }},
  {id:"ylitikki", key:"joker.ylitikki", g:"▲", p:7, r:"harvinainen", mode:"rami",
   add:c => { c.mult += 4 * c.usBefore; }},
  {id:"vyory", key:"joker.vyory", g:"≡", p:6, r:"harvinainen",
   add:c => { c.chips += 25 + 25 * c.scoredBefore; }},
  {id:"assa", key:"joker.assa", g:"A", p:7, r:"harvinainen",
   xm:c => c.cards.some(x => x.r === 14) ? 2 : 1},
  {id:"pikkurilli", key:"joker.pikkurilli", g:"2", p:6, r:"harvinainen",
   add:c => { if (Math.max.apply(null, c.cards.map(x => x.r)) <= 9) c.chips += 90; }},
  {id:"nelisuunta", key:"joker.nelisuunta", g:"◆", p:7, r:"harvinainen",
   xm:c => new Set(c.cards.map(x => x.s)).size === c.cards.length ? 2 : 1},
  {id:"ahne", key:"joker.ahne", g:"$", p:6, r:"harvinainen",
   add:c => { c.mult += Math.min(12, Math.floor(c.money / 4)); }},
  {id:"kahvitauko", key:"joker.kahvitauko", g:"☕", p:7, r:"harvinainen",
   add:c => { c.mult += 2; }, won:c => { c.payout += 1; }},
  {id:"ryostaja", key:"joker.ryostaja", g:"▶", p:9, r:"eepos", mode:"rami",
   xm:c => c.robbery ? 2 : 1},
  {id:"tuppisuu", key:"joker.tuppisuu", g:"Ø", p:9, r:"eepos", mode:"nolo",
   xm:c => (c.mode === "nolo" && c.usBefore === 0) ? 3 : 1},
  {id:"kaksoiskaveri", key:"joker.kaksoiskaveri", g:"2×", p:9, r:"eepos",
   retrig:c => (c.winner === 2 || c.lead === 2) ? 1 : 0},
  {id:"vanhatuppi", key:"joker.vanhatuppi", g:"★", p:10, r:"eepos", tuppi:1},
  {id:"kivenveistaja", key:"joker.kivenveistaja", g:"◼", p:7, r:"harvinainen",
   add:c => { c.chips += 70 * c.cards.filter(isStone).length; }},
  {id:"villimies", key:"joker.villimies", g:"✦", p:8, r:"harvinainen",
   xm:c => c.cards.some(isWild) ? 2 : 1},
  {id:"pakkamestari", key:"joker.pakkamestari", g:"▤", p:9, r:"eepos",
   xm:c => 1 + 0.2 * c.sideDeckEnh}
];

/* Korttijalosteet. Kaksi parasta eivät lisää numeroita vaan taivuttavat tupin sääntöjä:
   kivikortilla ei ole maata (ohittaa maantuntopakon) eikä arvoa (ei voi voittaa tikkiä),
   villi kortti kelpaa jokaiseen maahan. */

// prettier-ignore
export const ENH = {
  stone:{key:"enh.stone", g:"◼", p:8},
  wild: {key:"enh.wild",  g:"✦", p:7},
  steel:{key:"enh.steel", g:"▮", p:7},
  glass:{key:"enh.glass", g:"◇", p:6},
  bonus:{key:"enh.bonus", g:"+", p:5},
  mult: {key:"enh.mult",  g:"!", p:5},
  gold: {key:"enh.gold",  g:"$", p:5}
};

// prettier-ignore
export const CONSUMABLES = [
  {id:"kannanvaihto", key:"cons.kannanvaihto", g:"↕", p:5,},
  {id:"kurkistus", key:"cons.kurkistus", g:"◉", p:3,},
  {id:"vaihtokauppa", key:"cons.vaihtokauppa", g:"↔", p:5,},
  {id:"uusijako", key:"cons.uusijako", g:"↻", p:4,},
  {id:"tikkivarkaus", key:"cons.tikkivarkaus", g:"»", p:6,}
];

// prettier-ignore
export const VOUCHERS = [
  {id:"teroitin", key:"voucher.teroitin",     g:"+", p:7},
  {id:"tuppisormus", key:"voucher.tuppisormus",  g:"○", p:10},
  {id:"kahvipannu", key:"voucher.kahvipannu",   g:"J", p:8},
  {id:"muistikirja", key:"voucher.muistikirja",  g:"M", p:8},
  {id:"hihalaukku", key:"voucher.hihalaukku",   g:"▽", p:9},
  {id:"isompipakka", key:"voucher.isompipakka", g:"▤", p:7}
];

// prettier-ignore
export const BOSSES = [
  {id:"umpimahka", key:"boss.umpimahka"},
  {id:"punainen", key:"boss.punainen"},
  {id:"kasijarru", key:"boss.kasijarru"},
  {id:"pakkorami", key:"boss.pakkorami"},
  {id:"kitsas", key:"boss.kitsas"}
];
