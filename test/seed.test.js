/* Seeded randomness: the same seed must replay the same run, which is what makes
   the balance simulations reproducible. */
import { group, ok, eq } from "./harness.js";
import { rnd, setSeed, makeSeed, seedHash, SEED_ALPHABET } from "../src/rng.js";
import { newGame } from "../src/state.js";
import { deal } from "../src/flow.js";
import { rollShop } from "../src/shop.js";

group("Seeds and reproducibility");

function dealWith(seed) {
  const g = newGame(seed);
  deal();
  return g.hands.map((h) => h.map((c) => c.id).join(",")).join("|");
}

const d1 = dealWith("TUPPI");
eq("the same seed produces the same deal", d1, dealWith("TUPPI"));
ok(
  "a different seed produces a different deal",
  dealWith("TUPPI") !== dealWith("NOLO"),
  "two different seeds produced the same deal",
);
eq("the deal still holds 52 cards", d1.split("|").join(",").split(",").length, 52);

eq("the seed is normalised to upper case", newGame("  tuppi  ").seed, "TUPPI");
eq("  and yields the same stream as the clean form", dealWith("  tuppi  "), dealWith("TUPPI"));
eq("an empty seed draws a new one", newGame("").seed.length, 8);
ok(
  "a generated seed uses only unambiguous characters",
  makeSeed()
    .split("")
    .every((ch) => SEED_ALPHABET.includes(ch)),
);
ok("a generated seed avoids O/0/I/1", !/[O0I1]/.test(makeSeed() + makeSeed() + makeSeed()));

eq("seedHash is stable", seedHash("TUPPI"), seedHash("TUPPI"));
ok("seedHash separates seeds", seedHash("TUPPI") !== seedHash("TUPPJ"));

const g = newGame("RNGTEST");
setSeed(g, "RNGTEST");
const draws = Array.from({ length: 500 }, () => rnd());
ok(
  "rnd stays within [0,1)",
  draws.every((v) => v >= 0 && v < 1),
);
ok("rnd does not stick on one value", new Set(draws).size > 450);
setSeed(g, "RNGTEST");
eq(
  "rnd replays from the seed",
  Array.from({ length: 500 }, () => rnd()).join(","),
  draws.join(","),
);

/* The shop draws from the same stream, so it replays too. */
function shopWith(seed) {
  const s = newGame(seed);
  deal();
  rollShop(true);
  return s.shop.map((i) => i.kind + ":" + i.data.n).join(" | ");
}
eq("the shop stock replays from the seed", shopWith("KAUPPA"), shopWith("KAUPPA"));
ok("a different seed gives different stock", shopWith("KAUPPA") !== shopWith("KAUPPA2"));

eq("newGame accepts a seed", newGame("OMASIEMEN").seed, "OMASIEMEN");
eq("newGame without a seed draws one", newGame().seed.length, 8);
