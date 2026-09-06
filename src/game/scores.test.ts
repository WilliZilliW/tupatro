/* The scoreboard: the order, the truncation and what a corrupt payload does.
   The module is pure and takes its timestamp as a parameter, so none of this
   needs a clock or a browser. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHALLENGE_SCORES_VERSION,
  SCORES_MAX,
  SCORES_VERSION,
  addChallengeScore,
  addScore,
  challengeRowFor,
  parseChallengeScores,
  parseScores,
  rowFor,
} from "./scores";
import {
  clearRun,
  readChallengeScores,
  readScores,
  writeChallengeScores,
  writeRun,
  writeScores,
} from "./storage";
import { dehydrate } from "./save";
import { createRun } from "./state";
import type { ChallengeRow, ScoreRow } from "./scores";

const row = (over: Partial<ScoreRow> = {}): ScoreRow => ({
  seed: "SEED",
  ante: 3,
  blindIdx: 1,
  runScore: 5000,
  won: false,
  at: 1000,
  ...over,
});

const build = (rows: ScoreRow[]): ScoreRow[] => rows.reduce(addScore, [] as ScoreRow[]);
const seeds = (rows: ScoreRow[]) => rows.map((r) => r.seed);

describe("the board is sorted best first", () => {
  /* Deliberately shuffled, and every key decides at least one pair: WON beats
     the higher ante, ANTE8 beats the higher score, and TIE-A beats TIE-B on
     nothing but the earlier timestamp. */
  const TEN: ScoreRow[] = [
    row({ seed: "P6", ante: 4, runScore: 3000 }),
    row({ seed: "TIE-B", ante: 5, runScore: 9000, at: 2000 }),
    row({ seed: "P9", ante: 2, runScore: 8000 }),
    row({ seed: "WON2", ante: 1, runScore: 10, won: true, at: 9000 }),
    row({ seed: "P8", ante: 2, runScore: 9000 }),
    row({ seed: "ANTE8", ante: 8, runScore: 1 }),
    row({ seed: "TIE-A", ante: 5, runScore: 9000, at: 1500 }),
    row({ seed: "WON1", ante: 2, runScore: 5, won: true, at: 9000 }),
    row({ seed: "P7", ante: 4, runScore: 2000 }),
    row({ seed: "P10", ante: 1, runScore: 99999 }),
  ];

  it("puts won runs first, then the higher ante, score and the earlier row", () => {
    expect(seeds(build(TEN))).toEqual([
      "WON1",
      "WON2",
      "ANTE8",
      "TIE-A",
      "TIE-B",
      "P6",
      "P7",
      "P8",
      "P9",
      "P10",
    ]);
  });

  it("drops an eleventh row worse than all of them", () => {
    const full = build(TEN);
    const worse = row({ seed: "WORST", ante: 1, runScore: 0, at: 20000 });
    const after = addScore(full, worse);
    expect(after).toHaveLength(SCORES_MAX);
    expect(seeds(after)).toEqual(seeds(full));
  });

  it("evicts exactly the last row for an eleventh that beats it", () => {
    const full = build(TEN);
    /* Between P9 and P10 on ante: it lands ninth and pushes only P10 off. */
    const better = row({ seed: "NEW", ante: 2, runScore: 8500, at: 20000 });
    const after = addScore(full, better);
    expect(after).toHaveLength(SCORES_MAX);
    expect(seeds(after)).toEqual([...seeds(full).slice(0, 8), "NEW", "P9"]);
    expect(seeds(after)).not.toContain("P10");
  });
});

describe("the same result is one row", () => {
  it("keeps the row already on the board, with its own timestamp", () => {
    const rows = build([row({ seed: "A", ante: 4 }), row({ seed: "B", ante: 2 })]);
    const r = row({ seed: "C", ante: 3, at: 4000 });
    const once = addScore(rows, r);
    expect(addScore(once, { ...r, at: r.at + 5000 })).toEqual(once);
    expect(once.find((x) => x.seed === "C")?.at).toBe(4000);
  });

  it("still files a run that differs on any scored field", () => {
    const r = row({ seed: "C" });
    const once = addScore([], r);
    expect(addScore(once, { ...r, runScore: r.runScore + 1 })).toHaveLength(2);
  });
});

describe("rowFor reads the run", () => {
  it("takes the seed, ante, blind and run total from the state", () => {
    const g = { ...createRun("ROWFOR"), ante: 5, blindIdx: 2, runScore: 12345 };
    expect(rowFor(g, true, 77)).toEqual({
      seed: "ROWFOR",
      ante: 5,
      blindIdx: 2,
      runScore: 12345,
      won: true,
      at: 77,
    });
  });
});

describe("parseScores refuses anything but a board of this version", () => {
  const payload = (rows: unknown) => ({ v: SCORES_VERSION, rows });

  it.each([
    ["not an object", 7],
    ["null", null],
    ["a string", "[]"],
    ["a bare array", [row()]],
    ["a wrong version", { v: SCORES_VERSION + 1, rows: [row()] }],
    ["no version", { rows: [row()] }],
    ["rows that are not an array", payload({ 0: row() })],
    ["a missing field", payload([{ ...row(), at: undefined }])],
    ["a numeric seed", payload([{ ...row(), seed: 3 }])],
    ["a string ante", payload([{ ...row(), ante: "3" }])],
    ["a string blindIdx", payload([{ ...row(), blindIdx: "1" }])],
    ["a string runScore", payload([{ ...row(), runScore: "5000" }])],
    ["a numeric won", payload([{ ...row(), won: 1 }])],
    ["a string at", payload([{ ...row(), at: "1000" }])],
    ["a row that is not an object", payload([row(), "nope"])],
  ])("returns [] for %s", (_label, raw) => {
    expect(parseScores(raw)).toEqual([]);
  });

  it("returns the ten best of a valid fifteen, in board order", () => {
    const fifteen = Array.from({ length: 15 }, (_, i) =>
      row({ seed: `S${i}`, ante: 1 + (i % 8), runScore: i * 100, at: 1000 + i }),
    );
    const parsed = parseScores(payload(fifteen));
    expect(parsed).toHaveLength(SCORES_MAX);
    expect(parsed).toEqual(build(fifteen));
  });
});

/* jsdom provides no Storage at all, which is why storage.ts guards every call.
   These two are about the bytes, so they install a minimal in-memory store. */
describe("the board is a key of its own", () => {
  const SCORES_KEY = "tupatro-scores-v1";
  const RUN_KEY = "tupatro-run-v1";

  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    } satisfies Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("survives clearRun, which takes the run key and nothing else", () => {
    writeRun(dehydrate(createRun("KEEP")));
    writeScores([row({ seed: "KEEP" })]);
    const before = localStorage.getItem(SCORES_KEY);
    clearRun();
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
    expect(localStorage.getItem(SCORES_KEY)).toBe(before);
    expect(readScores()).toEqual([row({ seed: "KEEP" })]);
  });

  it("reads back nothing when the stored board will not parse", () => {
    localStorage.setItem(SCORES_KEY, "{ not json");
    expect(readScores()).toEqual([]);
  });
});

/* ==================== the challenge board ====================
   A second board with its own shape, its own version and its own key. The
   main board's own tests above are untouched: nothing here reads or writes
   tupatro-scores-v1. */
describe("the challenge board", () => {
  const crow = (over: Partial<ChallengeRow> = {}): ChallengeRow => ({
    seed: "SEED",
    score: 100,
    at: 1000,
    ...over,
  });
  const build = (rows: ChallengeRow[]) => rows.reduce(addChallengeScore, [] as ChallengeRow[]);
  const seeds = (rows: ChallengeRow[]) => rows.map((r) => r.seed);

  it("builds a row from the run's own score", () => {
    const g = { ...createRun("CHALROW"), runScore: 137 };
    expect(challengeRowFor(g, 4242)).toEqual({ seed: "CHALROW", score: 137, at: 4242 });
  });

  it("sorts by score descending and breaks a tie on the earlier row", () => {
    const rows = build([
      crow({ seed: "MID", score: 90 }),
      crow({ seed: "TIE-B", score: 200, at: 3000 }),
      crow({ seed: "TOP", score: 340 }),
      crow({ seed: "TIE-A", score: 200, at: 2000 }),
    ]);
    expect(seeds(rows)).toEqual(["TOP", "TIE-A", "TIE-B", "MID"]);
  });

  /* A challenge score is allowed below zero, so the board must sort one
     rather than treat it as missing. */
  it("keeps a negative score, below every positive one", () => {
    const rows = build([crow({ seed: "NEG", score: -12 }), crow({ seed: "POS", score: 3 })]);
    expect(seeds(rows)).toEqual(["POS", "NEG"]);
    expect(rows[1].score).toBe(-12);
  });

  it("truncates to ten", () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      crow({ seed: `S${i}`, score: i * 10, at: 1000 + i }),
    );
    const rows = build(many);
    expect(rows).toHaveLength(SCORES_MAX);
    expect(rows[0].score).toBe(130);
    expect(rows[SCORES_MAX - 1].score).toBe(40);
  });

  /* StrictMode's double effect files the same result twice. The board must
     not grow, and the row already on it keeps its timestamp. */
  it("is idempotent on the seed and the score", () => {
    const first = crow({ seed: "SAME", score: 55, at: 1000 });
    const again = crow({ seed: "SAME", score: 55, at: 9999 });
    const rows = addChallengeScore(addChallengeScore([], first), again);
    expect(rows).toHaveLength(1);
    expect(rows[0].at).toBe(1000);
  });

  it("files a replay of the same seed with a different score as its own row", () => {
    const rows = addChallengeScore(addChallengeScore([], crow({ score: 55 })), crow({ score: 60 }));
    expect(rows).toHaveLength(2);
  });

  it.each([
    ["a non-object", 42],
    ["null", null],
    ["another version", { v: CHALLENGE_SCORES_VERSION + 1, rows: [crow()] }],
    ["no version", { rows: [crow()] }],
    ["rows that are not an array", { v: CHALLENGE_SCORES_VERSION, rows: {} }],
    ["a row with no seed", { v: CHALLENGE_SCORES_VERSION, rows: [{ score: 1, at: 1 }] }],
    ["a row with no score", { v: CHALLENGE_SCORES_VERSION, rows: [{ seed: "S", at: 1 }] }],
    ["a row with no timestamp", { v: CHALLENGE_SCORES_VERSION, rows: [{ seed: "S", score: 1 }] }],
    [
      "a row with the main board's shape",
      { v: CHALLENGE_SCORES_VERSION, rows: [{ seed: "S", ante: 1, blindIdx: 0, runScore: 1 }] },
    ],
  ])("rejects %s", (_label, raw) => {
    expect(parseChallengeScores(raw)).toEqual([]);
  });

  it("re-sorts a hand-edited board rather than trusting its order", () => {
    const raw = {
      v: CHALLENGE_SCORES_VERSION,
      rows: [crow({ seed: "LOW", score: 1 }), crow({ seed: "HIGH", score: 900 })],
    };
    expect(seeds(parseChallengeScores(raw))).toEqual(["HIGH", "LOW"]);
  });
});

describe("the challenge board keeps a key of its own", () => {
  const crow = (over: Partial<ChallengeRow> = {}): ChallengeRow => ({
    seed: "SEED",
    score: 100,
    at: 1000,
    ...over,
  });

  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    } satisfies Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips through its own key and leaves the main board alone", () => {
    writeScores([row({ seed: "MAIN" })]);
    const before = localStorage.getItem("tupatro-scores-v1");
    writeChallengeScores("rummikub", [crow({ seed: "CH", score: 12 })]);
    expect(readChallengeScores("rummikub")).toEqual([crow({ seed: "CH", score: 12 })]);
    expect(localStorage.getItem("tupatro-scores-v1")).toBe(before);
    expect(localStorage.getItem("tupatro-challenge-rummikub-v1")).not.toBeNull();
    expect(readScores().map((r) => r.seed)).toEqual(["MAIN"]);
  });

  it("reads back nothing when the stored board will not parse", () => {
    localStorage.setItem("tupatro-challenge-rummikub-v1", "{ not json");
    expect(readChallengeScores("rummikub")).toEqual([]);
  });
});
