import { isStone, isWild } from "./cards.js";

/* mode: "rami" | "nolo" | null (= molemmissa) */
// prettier-ignore
export const JOKERS = [
  {id:"ramikone", n:"Ramikone", g:"↑", p:5, r:"yleinen", mode:"rami",
   t:"Ramissa +6 Mult", add:c => { if (c.mode === "rami") c.mult += 6; }},
  {id:"nolomestari", n:"Nolomestari", g:"↓", p:5, r:"yleinen", mode:"nolo",
   t:"Nolossa +6 Mult", add:c => { if (c.mode === "nolo") c.mult += 6; }},
  {id:"roskakuski", n:"Roskakuski", g:"▼", p:5, r:"yleinen", mode:"nolo",
   t:"Nolossa +30 Chips jokaisesta kuvakortista tikissä",
   add:c => { if (c.mode === "nolo") c.chips += 30 * c.cards.filter(x => x.r >= 11 && x.r <= 13).length; }},
  {id:"herttaherra", n:"Hertta-Herra", g:"♥", p:5, r:"yleinen",
   t:"+25 Chips jokaisesta hertasta tikissä",
   add:c => { c.chips += 25 * c.cards.filter(x => x.s === "H").length; }},
  {id:"patapaa", n:"Patapää", g:"♠", p:5, r:"yleinen",
   t:"+25 Chips jokaisesta padasta tikissä",
   add:c => { c.chips += 25 * c.cards.filter(x => x.s === "S").length; }},
  {id:"kuvakauppias", n:"Kuvakauppias", g:"K", p:5, r:"yleinen",
   t:"+20 Chips jokaisesta kuvakortista (J/Q/K)",
   add:c => { c.chips += 20 * c.cards.filter(x => x.r >= 11 && x.r <= 13).length; }},
  {id:"variveikko", n:"Väriveikko", g:"♦", p:6, r:"yleinen",
   t:"+70 Chips jos tikki on väri",
   add:c => { if (c.type.id === "flush" || c.type.id === "sf") c.chips += 70; }},
  {id:"kaveri", n:"Hyvä Kaveri", g:"V", p:5, r:"yleinen",
   t:"+5 Mult jos Veikko vei tikin", add:c => { if (c.winner === 2) c.mult += 5; }},
  {id:"etukasi", n:"Etukäsi", g:"→", p:5, r:"yleinen",
   t:"+5 Mult jos sinä ajoit tikin", add:c => { if (c.lead === 0) c.mult += 5; }},
  {id:"ylitikki", n:"Ylitikki", g:"▲", p:7, r:"harvinainen", mode:"rami",
   t:"+4 Mult jokaisesta jo voittamastasi tikistä",
   add:c => { c.mult += 4 * c.usBefore; }},
  {id:"vyory", n:"Vyöry", g:"≡", p:6, r:"harvinainen",
   t:"+25 Chips, kasvaa +25 jokaisen pisteytetyn tikin jälkeen",
   add:c => { c.chips += 25 + 25 * c.scoredBefore; }},
  {id:"assa", n:"Ässänmetsästäjä", g:"A", p:7, r:"harvinainen",
   t:"×2 Mult jos tikissä on ässä",
   xm:c => c.cards.some(x => x.r === 14) ? 2 : 1},
  {id:"pikkurilli", n:"Pikkurilli", g:"2", p:6, r:"harvinainen",
   t:"+90 Chips jos tikin korkein kortti on 9 tai pienempi",
   add:c => { if (Math.max.apply(null, c.cards.map(x => x.r)) <= 9) c.chips += 90; }},
  {id:"nelisuunta", n:"Nelisuunta", g:"◆", p:7, r:"harvinainen",
   t:"×2 Mult jos tikissä on kaikkia maita",
   xm:c => new Set(c.cards.map(x => x.s)).size === c.cards.length ? 2 : 1},
  {id:"ahne", n:"Ahne Aatami", g:"$", p:6, r:"harvinainen",
   t:"+1 Mult jokaista $4 kohden (enintään +12)",
   add:c => { c.mult += Math.min(12, Math.floor(c.money / 4)); }},
  {id:"kahvitauko", n:"Kahvitauko", g:"☕", p:7, r:"harvinainen",
   t:"+2 Mult ja +$1 jokaisesta pisteytetystä tikistä",
   add:c => { c.mult += 2; }, won:c => { c.payout += 1; }},
  {id:"ryostaja", n:"Ryöstäjä", g:"▶", p:9, r:"eepos", mode:"rami",
   t:"Ryöstössä (vastustajat ramasivat) ×2 Mult",
   xm:c => c.robbery ? 2 : 1},
  {id:"tuppisuu", n:"Tuppisuu", g:"Ø", p:9, r:"eepos", mode:"nolo",
   t:"Nolossa ×3 Mult, jos et ole vienyt yhtään tikkiä",
   xm:c => (c.mode === "nolo" && c.usBefore === 0) ? 3 : 1},
  {id:"kaksoiskaveri", n:"Kaksoiskaveri", g:"2×", p:9, r:"eepos",
   t:"Veikon vaikuttamat tikit pisteytetään kahdesti",
   retrig:c => (c.winner === 2 || c.lead === 2) ? 1 : 0},
  {id:"vanhatuppi", n:"Vanha Tuppi", g:"★", p:10, r:"eepos",
   t:"Tuppi-kerroin +1", tuppi:1},
  {id:"kivenveistaja", n:"Kivenveistäjä", g:"◼", p:7, r:"harvinainen",
   t:"+70 Chips jokaisesta kivikortista tikissä",
   add:c => { c.chips += 70 * c.cards.filter(isStone).length; }},
  {id:"villimies", n:"Villimies", g:"✦", p:8, r:"harvinainen",
   t:"×2 Mult jos tikissä on villi kortti",
   xm:c => c.cards.some(isWild) ? 2 : 1},
  {id:"pakkamestari", n:"Pakkamestari", g:"▤", p:9, r:"eepos",
   t:"×0,2 Mult jokaisesta jalostetusta kortista tuppipakassasi",
   xm:c => 1 + 0.2 * c.sideDeckEnh}
];

/* Korttijalosteet. Kaksi parasta eivät lisää numeroita vaan taivuttavat tupin sääntöjä:
   kivikortilla ei ole maata (ohittaa maantuntopakon) eikä arvoa (ei voi voittaa tikkiä),
   villi kortti kelpaa jokaiseen maahan. */

// prettier-ignore
export const ENH = {
  stone:{n:"Kivikortti", g:"◼", p:8, t:"Ei maata eikä arvoa: saa pelata mihin tikkiin tahansa eikä voi koskaan voittaa tikkiä. +50 Chips"},
  wild: {n:"Villi kortti", g:"✦", p:7, t:"Kelpaa jokaiseen maahan — maantuntopakko ei sido"},
  steel:{n:"Teräskortti", g:"▮", p:7, t:"×1.5 Mult jokaiseen pisteytettyyn tikkiin niin kauan kuin kortti on yhä kädessäsi"},
  glass:{n:"Lasikortti", g:"◇", p:6, t:"×2 Chips tikkiin, mutta 1/4 että kortti särkyy pysyvästi"},
  bonus:{n:"Bonuskortti", g:"+", p:5, t:"+40 Chips kun kortti on pisteytetyssä tikissä"},
  mult: {n:"Multikortti", g:"!", p:5, t:"+5 Mult kun kortti on pisteytetyssä tikissä"},
  gold: {n:"Kultakortti", g:"$", p:5, t:"+$3 kun sen tikki pisteytyy"}
};

// prettier-ignore
export const CONSUMABLES = [
  {id:"kannanvaihto", n:"Kannanvaihto", g:"↕", p:5,
   t:"Vaihda jaon puheenaihe: ramista noloon tai päinvastoin (ennen 1. tikkiä)"},
  {id:"kurkistus", n:"Kurkistus", g:"◉", p:3,
   t:"Näet kaikkien kädet jaon loppuun asti"},
  {id:"vaihtokauppa", n:"Vaihtokauppa", g:"↔", p:5,
   t:"Vaihda huonoin korttisi Veikon parhaaseen"},
  {id:"uusijako", n:"Uusi jako", g:"↻", p:4,
   t:"Jaa kaikki kortit uudelleen (ennen 1. tikkiä)"},
  {id:"tikkivarkaus", n:"Tikkivarkaus", g:"»", p:6,
   t:"Seuraava tikki menee sinne minne haluat"}
];

// prettier-ignore
export const VOUCHERS = [
  {id:"teroitin",     n:"Teroitin",     g:"+", p:7,  t:"Kaikki kortit +3 Chips pysyvästi"},
  {id:"tuppisormus",  n:"Tuppisormus",  g:"○", p:10, t:"Tuppi-kerroin +1 pysyvästi"},
  {id:"kahvipannu",   n:"Kahvipannu",   g:"J", p:8,  t:"+1 jokeripaikka"},
  {id:"muistikirja",  n:"Muistikirja",  g:"M", p:8,  t:"+1 temppupaikka ja kauppaan 4. tavara"},
  {id:"hihalaukku",   n:"Hihalaukku",   g:"▽", p:9,  t:"+1 kortinvaihto joka jakoon"},
  {id:"isompipakka",  n:"Isompi pakka", g:"▤", p:7,  t:"+1 paikka tuppipakkaan"}
];

// prettier-ignore
export const BOSSES = [
  {id:"umpimahka",  n:"Umpimähkä",      t:"Veikko pelaa satunnaisesti — kaveriin ei ole luottamista."},
  {id:"punainen",   n:"Punainen kielto",t:"Hertat ja ruudut eivät tuota lainkaan Chipsejä."},
  {id:"kasijarru",  n:"Käsijarru",      t:"Tikkityyppi ei anna Multia — vain Chipsit ja jokerit."},
  {id:"pakkorami",  n:"Pakkorami",      t:"Sinun on näytettävä ramia. Nolo ei ole vaihtoehto."},
  {id:"kitsas",     n:"Kitsas kerroin", t:"Tuppi-kerroin −1 (vähintään ×1)."}
];
