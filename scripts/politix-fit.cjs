/* Layout proof for the Politix felt, which jsdom cannot give: jsdom lays out
   nothing, so `npm test` cannot see an overflow, a crushed card or an overlap.
   Usage: node scripts/politix-fit.cjs [baseUrl]   (default http://localhost:5173/)
   - Run it against a live `npm run dev`; it rewrites src/game/politix.ts as the
     dev server serves it, so it does not work against `npm run preview`.
   - It needs the globally installed `playwright`, resolved through NODE_PATH
     (NODE_PATH=/usr/local/lib/node_modules_global), and adds no dependency to
     package.json.
   - It is not run by `npm test` or CI.
   It measures 7 viewports x 3 player counts x 2 locales x 2 states (worst pile
   and fresh start) and exits non-zero, naming the case and the check, when any
   assertion fails or when its worst-case fixture did not apply. */
const { chromium } = require("playwright");

const base = process.argv[2] || "http://localhost:5173/";
const VIEWS = [
  [1280, 800],
  [1280, 500],
  [1000, 700],
  [800, 600],
  [844, 390],
  [390, 844],
  [360, 640],
];
const PLAYERS = [2, 3, 4];
const LOCALES = ["fi", "en"];
const STATES = ["worst", "fresh"];
const MARKER = "export function pxSetup(";

const WRAP = `
export function pxSetup(rng, mint, owner, players) {
  const px = __pxSetupOrig(rng, mint, owner, players);
  const playing = [0,1,2,3].filter(s => px.party[s] !== null);
  const foe = playing.find(s => px.party[s] !== px.party[owner]);
  let n = 0;
  const mk = (kind, group) => ({ uid: 'w' + (n++), kind, tactic: null, group: group ?? null });
  px.scandals[foe] = ['hippies','hippies','blondes','youth'].map(g => mk('scandal', g));
  for (const s of playing) px.burn[s] = mk('burnout');
  while (px.hands[owner].length < 15) px.hands[owner].push(px.draw.pop());
  px.event = 'doping';
  px.turn = owner;
  px.last = { p: foe, what: 'take', group: 'whitecollar', n: 3 };
  return px;
}`;

function inPage() {
  const felt = document.querySelector(".pxfelt");
  const out = [];
  const fail = (check, detail) => out.push(`${check}: ${detail}`);
  const fr = felt.getBoundingClientRect();
  const inner = {
    l: fr.left + felt.clientLeft,
    t: fr.top + felt.clientTop,
    r: fr.left + felt.clientLeft + felt.clientWidth,
    b: fr.top + felt.clientTop + felt.clientHeight,
  };
  const main = felt.querySelector(".pxmain");
  const layout = getComputedStyle(main).getPropertyValue("--px-layout").trim();
  const fontPx = parseFloat(getComputedStyle(main).fontSize);
  if (felt.scrollHeight > felt.clientHeight + 1 || felt.scrollWidth > felt.clientWidth + 1)
    fail(
      "1 felt scrolls",
      `${felt.scrollWidth}x${felt.scrollHeight} in ${felt.clientWidth}x${felt.clientHeight}`,
    );
  const R = (e) => e.getBoundingClientRect();
  const cls = (e) => e.className;
  const inside = [...felt.querySelectorAll(".pxvcard, .pxseat, .pxparty, .pxevcard, .pxpile > *")];
  for (const e of inside) {
    const b = R(e);
    if (
      b.bottom > inner.b + 0.5 ||
      b.right > inner.r + 0.5 ||
      b.left < inner.l - 0.5 ||
      b.top < inner.t - 0.5
    )
      fail(
        "2 outside felt",
        `${cls(e)} ${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.right)},${Math.round(b.bottom)}`,
      );
  }
  const set = [
    ...felt.querySelectorAll(".pxvcard, .pxseat, .pxsymbols > .pxparty"),
    ...felt.querySelectorAll(".pxevcard"),
  ];
  for (let i = 0; i < set.length; i++)
    for (let j = i + 1; j < set.length; j++) {
      const a = R(set[i]);
      const b = R(set[j]);
      if (
        a.left < b.right - 1 &&
        b.left < a.right - 1 &&
        a.top < b.bottom - 1 &&
        b.top < a.bottom - 1
      )
        fail("3 overlap", `${cls(set[i])} / ${cls(set[j])}`);
    }
  for (const pile of felt.querySelectorAll(".pxpile")) {
    const pol = pile.querySelector(".pxpol");
    const fan = [...pile.children].filter((c) => c !== pol);
    for (const f of fan) {
      if (!pol) continue;
      const a = R(f);
      const b = R(pol);
      if (
        a.left < b.right - 0.5 &&
        b.left < a.right - 0.5 &&
        a.top < b.bottom - 0.5 &&
        b.top < a.bottom - 0.5
      )
        fail("4 fan overlaps politician", cls(f));
    }
    for (let i = 1; i < fan.length; i++) {
      const em = parseFloat(getComputedStyle(fan[i]).fontSize);
      const a = R(fan[i - 1]);
      const b = R(fan[i]);
      if (layout === "stack" && b.left - a.left < em - 0.5)
        fail("4 stack step < 1em", `${(b.left - a.left).toFixed(1)}px < ${em}px`);
      if (layout === "side" && b.left < a.right - 0.5)
        fail("4 side faces overlap", `${i - 1}/${i}`);
    }
  }
  for (const c of felt.querySelectorAll(".pxcard"))
    if (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1)
      fail(
        "5 card text clipped",
        `${cls(c)} ${c.scrollWidth}x${c.scrollHeight} in ${c.clientWidth}x${c.clientHeight}`,
      );
  if (fontPx < 9) fail("6 font below 9px", fontPx.toFixed(2));
  const bar = document.querySelector(".pxbar");
  const hand = document.querySelector(".pxhandrow");
  for (const [n, e] of [
    ["bar", bar],
    ["hand", hand],
  ]) {
    const b = e && R(e);
    if (!e && n === "bar") continue; // the bar exists only on the owner's turn
    if (
      !b ||
      b.top < -0.5 ||
      b.left < -0.5 ||
      b.bottom > innerHeight + 0.5 ||
      b.right > innerWidth + 0.5
    )
      fail(
        "7 outside viewport",
        n + (b ? ` ${Math.round(b.top)}..${Math.round(b.bottom)} of ${innerHeight}` : " missing"),
      );
  }
  const d = document.documentElement;
  if (d.scrollHeight > innerHeight || d.scrollWidth > innerWidth)
    fail("8 page scrolls", `${d.scrollWidth}x${d.scrollHeight} in ${innerWidth}x${innerHeight}`);
  return { out, layout, fontPx };
}

function fixtureProblem() {
  const felt = document.querySelector(".pxfelt");
  let foeSum = 0;
  let foe = 0;
  for (const seat of felt.querySelectorAll(".pxseat")) {
    const sum = [...seat.querySelectorAll(".pxpile .pxk-scandal")].reduce(
      (a, c) => a + Number(c.getAttribute("data-count") || 1),
      0,
    );
    if (sum > 0) {
      foe++;
      foeSum += sum;
    }
    if (!seat.querySelector(".pxpile .pxk-burnout")) return "a seat has no burnout face";
  }
  if (foe !== 1 || foeSum !== 4)
    return `scandal data-count sum is ${foeSum} over ${foe} seats, expected 4 on one`;
  return null;
}

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  const minFont = {};
  let cases = 0;
  for (const state of STATES)
    for (const loc of LOCALES)
      for (const [w, h] of VIEWS)
        for (const pl of PLAYERS) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h } });
          const page = await ctx.newPage();
          await page.addInitScript((l) => {
            try {
              localStorage.clear();
              localStorage.setItem("tupatro-locale", l);
            } catch {}
          }, loc);
          let markerSeen = true;
          await page.route("**/src/game/politix.ts*", async (route) => {
            const r = await route.fetch();
            let body = await r.text();
            if (state === "worst") {
              if (!body.includes(MARKER)) markerSeen = false;
              else body = body.replace(MARKER, "function __pxSetupOrig(") + WRAP;
            }
            await route.fulfill({ response: r, body });
          });
          await page.goto(base);
          await page.waitForSelector(".menubtns");
          await page.locator(".menubtns .btn").first().click();
          const row = page.locator("li.chalrow", { has: page.locator(".pxplayers") });
          await row.locator(`button[data-players="${pl}"]`).click();
          await row.locator(".btn").first().click();
          await page.waitForSelector(".pxfelt .pxseat");
          await page.waitForTimeout(400);
          const name = `${state} ${loc} ${w}x${h} ${pl}p`;
          if (!markerSeen) {
            console.error(
              `FIXTURE: the served src/game/politix.ts has no marker "${MARKER}"; cannot build the worst case.`,
            );
            await browser.close();
            process.exit(2);
          }
          if (state === "worst") {
            const bad = await page.evaluate(fixtureProblem);
            if (bad) {
              console.error(`FIXTURE: the worst-case patch did not apply (${name}): ${bad}`);
              await browser.close();
              process.exit(2);
            }
          }
          const res = await page.evaluate(inPage);
          cases++;
          const key = `${w}x${h}`;
          minFont[key] = Math.min(minFont[key] ?? 99, res.fontPx);
          for (const f of res.out)
            failures.push(`${name} [${res.layout} ${res.fontPx.toFixed(1)}px] ${f}`);
          await ctx.close();
        }
  await browser.close();
  console.log(
    `min .pxmain font-size per viewport: ${JSON.stringify(Object.fromEntries(Object.entries(minFont).map(([k, v]) => [k, +v.toFixed(2)])))}`,
  );
  for (const f of failures) console.log("FAIL " + f);
  const failedCases = new Set(failures.map((f) => f.split(" [")[0])).size;
  console.log(
    `politix-fit: ${cases - failedCases}/${cases} cases pass, ${failures.length} failing checks`,
  );
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
