export const SUITS = ["S", "H", "D", "C"];

// prettier-ignore
export const SM = {
  S:{g:"♠", n:"Pata",   red:false},
  H:{g:"♥", n:"Hertta", red:true },
  D:{g:"♦", n:"Ruutu",  red:true },
  C:{g:"♣", n:"Risti",  red:false}
};

export const RN = { 11: "J", 12: "Q", 13: "K", 14: "A" };

// prettier-ignore
export const SEATS = [
  {name:"Sinä",   short:"S"},
  {name:"Raimo",  short:"R"},
  {name:"Veikko", short:"V"},
  {name:"Sirpa",  short:"I"}
];

export const rankLabel = (r) => RN[r] || String(r);

export const isUs = (p) => p === 0 || p === 2;

/* Tikkityypit. Maantuntopakon takia väri on tavallisin tikki -> matala perustaso. */

/* Tikkityypit. Maantuntopakon takia väri on tavallisin tikki -> matala perustaso. */
// prettier-ignore
export const TYPES = {
  high:    {id:"high",     n:"Sekatikki", chips:15,  mult:1},
  pair:    {id:"pair",     n:"Pari",      chips:25,  mult:2},
  flush:   {id:"flush",    n:"Väri",      chips:30,  mult:2},
  twopair: {id:"twopair",  n:"Kaksi paria", chips:45, mult:3},
  straight:{id:"straight", n:"Suora",     chips:55,  mult:3},
  trips:   {id:"trips",    n:"Kolmoset",  chips:70,  mult:4},
  sf:      {id:"sf",       n:"Värisuora", chips:110, mult:6},
  quad:    {id:"quad",     n:"Neloset",   chips:150, mult:8}
};

/* mode: "rami" | "nolo" | null (= molemmissa) */

export const ANTES = [500, 800, 1250, 1900, 2900, 4400, 6800, 10500];

export const BLIND_MULT = [1, 1.5, 2];

export const BLIND_NAME = ["Pieni panos", "Iso panos", "Pomopanos"];

export const BLIND_REWARD = [3, 4, 5];

/* ==================== siemenellinen satunnaisuus ====================
   Kaikki pelilogiikan satunnaisuus kulkee rnd():n läpi, jotta sama siemen
   ja samat pelaajan päätökset tuottavat saman ajon. Renderöinti ei kuluta
   satunnaisuutta, joten toisto ei hajoa animaatioihin. */
