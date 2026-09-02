#!/usr/bin/env node
/*
 * Build: src/ ES modules -> one self-contained tupatro.html
 *
 * A published Artifact cannot load external scripts, so the deliverable has to
 * be a single file. Rather than pull in a bundler, this concatenates the modules
 * in dependency order, strips the import/export keywords and wraps the result in
 * one IIFE. That works because every top-level name in src/ is unique, which the
 * build verifies rather than assumes.
 */
"use strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "tupatro.html");

/* Dependency order. Cycles between modules are fine at runtime (functions are
   hoisted and only called after boot), but the concatenated file still needs a
   deterministic order, so it is declared rather than inferred. */
const MODULES = [
  "src/constants.js",
  /* Locale tables before i18n.js: LOCALES is built at module evaluation time. */
  "src/locale/fi.js",
  "src/locale/en.js",
  "src/i18n.js",
  "src/cards.js",
  "src/content.js",
  "src/rng.js",
  "src/state.js",
  "src/rules.js",
  "src/scoring.js",
  "src/ai.js",
  "src/shop.js",
  "src/flow.js",
  "src/ui/dom.js",
  "src/ui/render.js",
  "src/ui/screens.js",
  "src/main.js",
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/* A module missing from MODULES is invisible to the tests, which import real ES
   modules, and only shows up as a ReferenceError in the browser. So the build
   refuses to run unless every source file is listed. */
function checkModuleListIsComplete() {
  const found = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) found.push(path.relative(ROOT, p).split(path.sep).join("/"));
    }
  })(path.join(ROOT, "src"));
  for (const f of found.sort()) {
    if (!MODULES.includes(f)) fail(`${f} exists but is not listed in MODULES (build.js)`);
  }
  for (const m of MODULES) {
    if (!found.includes(m)) fail(`${m} is listed in MODULES but does not exist`);
  }
}

/* --- strip module syntax ------------------------------------------------ */
function stripModuleSyntax(src, rel) {
  const lines = src.split("\n");
  const out = [];
  let inImport = false;
  for (const line of lines) {
    /* Imports are dropped entirely: concatenation order resolves the
       dependencies. Prettier wraps long import lists, so a statement may span
       several lines -- consume until its terminating semicolon. */
    if (inImport) {
      if (/;\s*$/.test(line)) inImport = false;
      continue;
    }
    if (/^import\s/.test(line)) {
      if (!/;\s*$/.test(line)) inImport = true;
      continue;
    }
    if (/^export\s+default/.test(line)) fail(`${rel}: export default is not supported`);
    out.push(line.replace(/^export\s+/, ""));
  }
  if (inImport) fail(`${rel}: unterminated import statement`);
  return out.join("\n");
}

const problems = [];
function fail(msg) {
  problems.push(msg);
}

/* --- collect and check -------------------------------------------------- */
checkModuleListIsComplete();
const declared = new Map(); // name -> module that declared it
const pieces = [];

for (const rel of MODULES) {
  const raw = read(rel);

  for (const m of raw.matchAll(/^export\s+(?:function|const|let)\s+(\w+)/gm)) {
    const name = m[1];
    if (declared.has(name)) {
      fail(`duplicate top-level name "${name}" in ${rel} and ${declared.get(name)}`);
    }
    declared.set(name, rel);
  }
  /* Non-exported top-level names share the same scope after concatenation, so
     they have to be unique too. */
  for (const m of raw.matchAll(/^(?:function|const|let)\s+(\w+)/gm)) {
    const name = m[1];
    if (declared.has(name)) {
      fail(`duplicate top-level name "${name}" in ${rel} and ${declared.get(name)}`);
    }
    declared.set(name, rel);
  }

  pieces.push(
    `/* ==== ${rel} ${"=".repeat(Math.max(0, 60 - rel.length))} */\n` +
      stripModuleSyntax(raw, rel).trim(),
  );
}

const bundle = '"use strict";\n' + pieces.join("\n\n") + "\n";

/* --- assemble the page -------------------------------------------------- */
const template = read("src/index.html");
const css = read("src/style.css").trim();

if (!template.includes("<!--STYLE-->") || !template.includes("<!--SCRIPT-->")) {
  fail("src/index.html is missing the <!--STYLE--> or <!--SCRIPT--> placeholder");
}

const html = template
  .replace("<!--STYLE-->", () => css)
  .replace("<!--SCRIPT-->", () => "(function(){\n" + bundle + "})();");

/* --- validate the output ------------------------------------------------ */
if (!html.startsWith('<meta charset="utf-8">')) fail("output must start with the charset meta");
if ((html.match(/<script/g) || []).length !== 1) fail("output must contain exactly one <script>");
if ((html.match(/<style>/g) || []).length !== 1) fail("output must contain exactly one <style>");
if (/<script[^>]+src=/.test(html)) fail("output must not reference external scripts");
if (/^\s*(import|export)\s/m.test(html.split("<script>")[1] || "")) {
  fail("module syntax survived into the bundle");
}

if (problems.length) {
  console.error("build failed:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(
  `built dist/tupatro.html  ${kb} kB  ` +
    `(${MODULES.length} modules, ${declared.size} top-level names, ` +
    `${html.split("\n").length} lines)`,
);
