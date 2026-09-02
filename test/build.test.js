/* The build output is the actual deliverable, so its invariants are tested too:
   the Artifact CSP means it has to stay self-contained. Also guards the source
   boundaries that keep the core testable. */
import { group, ok, eq } from "./harness.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "dist", "tupatro.html"), "utf8");
const script = html.split("<script>")[1] || "";
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const count = (re) => (script.match(re) || []).length;

group("Build output");
ok("charset is on the first line", html.startsWith('<meta charset="utf-8">'));
eq("exactly one script block", (html.match(/<script/g) || []).length, 1);
eq("exactly one style block", (html.match(/<style>/g) || []).length, 1);
ok("no external scripts", !/<script[^>]+src=/.test(html));
ok("no module syntax survived the bundle", !/^\s*(import|export)\s/m.test(script));
ok("the bundle is wrapped, not leaked into global scope", script.includes("(function(){"));
ok("a deliberate debug surface exists", script.includes("window.tupatro"));

group("Fonts");
const fontDecls = html.match(/--font-[dbm]:[^;]+;/g) || [];
eq("three font variables", fontDecls.length, 3);
ok(
  "every font has a fallback",
  fontDecls.every((d) => d.split(",").length >= 2),
);

group("Source boundaries");
/* The pure core must not import the shared state binding or touch the DOM --
   that is what lets the rule tests run without a browser. */
for (const rel of [
  "src/cards.js",
  "src/rng.js",
  "src/rules.js",
  "src/scoring.js",
  "src/ai.js",
  "src/content.js",
  "src/constants.js",
]) {
  const t = src(rel);
  ok(`${rel} does not import the G binding`, !/import \{[^}]*\bG\b[^}]*\} from/.test(t));
  ok(`${rel} does not touch the DOM`, !/\bdocument\.|\bwindow\./.test(t));
}

group("Invariants");
ok(
  "game logic uses the seeded generator, not Math.random",
  count(/Math\.random/g) === 1,
  "found " + count(/Math\.random/g) + " sites (only makeSeed is allowed)",
);
ok(
  "a run start is never wired straight to onclick",
  !/onclick = (newGame|startRun)[^(]/.test(script),
  "that would pass an Event object in as the seed",
);
/* One choke point for timers: later() in state.js is the only caller of
   setTimeout, so clearTimers() can always cancel everything. A textual count is
   robust here precisely because there is exactly one legal call site. */
eq("setTimeout is called from exactly one place", count(/setTimeout\(/g), 1);
ok(
  "that place is the later() helper",
  /function later\([^)]*\)\s*\{[^}]*setTimeout\(/.test(script),
);
