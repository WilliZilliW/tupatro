/* Translations: the two catalogues must stay in step with each other and with
   the keys the code actually asks for. A missing key is a visible bug -- t()
   falls back to printing the key itself -- so these are cheap and worth having. */
import { group, ok, eq } from "./harness.js";
import { fi } from "../src/locale/fi.js";
import { en } from "../src/locale/en.js";
import { setLocale, getLocale, t, tList, fmt, nameOf, descOf, LOCALES } from "../src/i18n.js";
import { JOKERS, ENH, CONSUMABLES, VOUCHERS, BOSSES } from "../src/content.js";
import { TYPES, SM } from "../src/constants.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js") && !p.includes("locale") && !p.endsWith("i18n.js"))
      srcFiles.push(p);
  }
})(path.join(ROOT, "src"));
const allSrc = srcFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

group("Catalogue parity");
{
  const kf = Object.keys(fi);
  const ke = Object.keys(en);
  eq("both catalogues have the same number of keys", ke.length, kf.length);
  const missing = kf.filter((k) => !(k in en));
  const extra = ke.filter((k) => !(k in fi));
  ok("no key missing from en", missing.length === 0, missing.join(", "));
  ok("no key in en that fi lacks", extra.length === 0, extra.join(", "));

  /* A placeholder that exists in one language and not the other renders as
     literal {braces} for that language. */
  const vars = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(",");
  const mismatched = kf.filter((k) => typeof fi[k] === "string" && vars(fi[k]) !== vars(en[k]));
  ok("placeholders match between languages", mismatched.length === 0, mismatched.join(", "));

  const listKeys = kf.filter((k) => Array.isArray(fi[k]));
  ok(
    "list keys are lists in both",
    listKeys.every((k) => Array.isArray(en[k])),
  );
  ok(
    "lists have the same length in both",
    listKeys.every((k) => en[k].length === fi[k].length),
    listKeys.filter((k) => en[k].length !== fi[k].length).join(", "),
  );
  ok("there is at least one list key", listKeys.length >= 2);

  /* tList is the accessor the rules panel uses; a non-list key must not leak
     a string into a .map(). */
  setLocale("fi");
  eq("tList returns the active language's list", tList(listKeys[0]).length, fi[listKeys[0]].length);
  setLocale("en");
  eq("  and switches with the language", tList(listKeys[0])[0], en[listKeys[0]][0]);
  eq("tList on a plain string key returns an empty list", tList("rules.title").length, 0);
  eq("tList on an unknown key returns an empty list", tList("no.such.list").length, 0);
}

group("Every key the code asks for exists");
{
  /* Literal t("...") / tList("...") calls. */
  const asked = new Set();
  /* Prefixes such as t("suit." + s) are not keys in themselves; the dynamic
     halves are covered by the data-table group below. */
  for (const m of allSrc.matchAll(/\bt(?:List)?\(\s*"([\w.]+)"/g)) {
    if (!m[1].endsWith(".")) asked.add(m[1]);
  }
  /* Keys used through a ternary, e.g. t(cond ? "a.b" : "c.d"). */
  for (const m of allSrc.matchAll(/"([a-z][A-Za-z]*\.[A-Za-z][\w.]*)"/g)) {
    if (m[1] in fi) asked.add(m[1]);
  }
  const unknown = [...asked].filter((k) => !(k in fi));
  ok("no unknown key is requested", unknown.length === 0, unknown.join(", "));
  ok("a meaningful number of keys are in use", asked.size > 150, "only " + asked.size);
}

group("Data tables resolve through the catalogue");
{
  const rows = [...JOKERS, ...CONSUMABLES, ...VOUCHERS, ...BOSSES, ...Object.values(ENH)];
  for (const loc of ["fi", "en"]) {
    setLocale(loc);
    const badName = rows.filter((x) => nameOf(x) === x.key + ".n");
    const badDesc = rows.filter((x) => descOf(x) === x.key + ".t");
    ok(`[${loc}] every row has a name`, badName.length === 0, badName.map((x) => x.key).join(", "));
    ok(
      `[${loc}] every row has a description`,
      badDesc.length === 0,
      badDesc.map((x) => x.key).join(", "),
    );
    const badType = Object.values(TYPES).filter((ty) => t("type." + ty.id) === "type." + ty.id);
    ok(`[${loc}] every trick type has a name`, badType.length === 0);
    const badSuit = Object.keys(SM).filter((s) => t("suit." + s) === "suit." + s);
    ok(`[${loc}] every suit has a name`, badSuit.length === 0);
    for (let i = 0; i < 3; i++)
      ok(`[${loc}] blind ${i} has a name`, t("blind." + i) !== "blind." + i);
  }
}

group("Switching language");
{
  setLocale("fi");
  eq("fi is selected", getLocale(), "fi");
  const fiTitle = t("rules.title");
  setLocale("en");
  eq("en is selected", getLocale(), "en");
  ok("the text actually changes", t("rules.title") !== fiTitle);
  eq("an unknown locale is ignored", setLocale("xx"), "en");
  ok("only the two locales are offered", Object.keys(LOCALES).join(",") === "fi,en");
}

group("Substitution and formatting");
{
  setLocale("en");
  eq("placeholders are filled", t("table.cardCount", { n: 7 }), "7 cards");
  ok("an unknown key falls back to itself", t("no.such.key") === "no.such.key");
  ok("a missing variable is left visible", t("table.cardCount", {}).includes("{n}"));
  eq("en groups thousands with a comma", fmt(1616), "1,616");
  setLocale("fi");
  ok("fi does not use a comma", !fmt(1616).includes(","), fmt(1616));
  ok("fi still groups thousands", fmt(1616) !== "1616", fmt(1616));
}

group("Finnish prose lives only in the catalogue");
{
  /* Every player-facing string now comes from src/locale/. A Finnish literal
     anywhere else in src/ means a string was missed in the conversion. */
  const offenders = [];
  for (const f of srcFiles) {
    const body = fs
      .readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const m of body.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)) {
      const s = m[1] !== undefined ? m[1] : m[2];
      if (/[äöÄÖ]/.test(s)) offenders.push(path.relative(ROOT, f) + ': "' + s.slice(0, 40) + '"');
    }
  }
  ok(
    "no Finnish string literal outside src/locale/",
    offenders.length === 0,
    offenders.join(" | "),
  );
}
