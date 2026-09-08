import { describe, expect, it } from "vitest";
import {
  QR_MAX_VERSION,
  blocksOf,
  dataCodewords,
  formatBits,
  qrMatrix,
  qrSize,
  reservedMask,
  totalCodewords,
  versionFor,
} from "./qr";
import { packSdp } from "./signal";
import { OFFER_SDP } from "./sdp.fixture";

/* ============================ a reader ============================
   Not a decoder: it assumes an undamaged symbol and so needs no
   Reed-Solomon. What it does prove is everything this project actually wrote
   — the module placement, the mask, the format field and the byte-mode
   stream — by walking them backwards. The error-correction codewords it
   ignores are checked another way: see the capacity table below, and the
   outside decoder recorded in the spec. */
function read(m: boolean[][]): string {
  const n = m.length;
  const version = (n - 17) / 4;
  const bit = (r: number, c: number) => (m[r][c] ? 1 : 0);

  /* The format field's first copy: fifteen bits, unmasked with 0x5412. */
  const fmt =
    [
      ...[0, 1, 2, 3, 4, 5].map((i) => bit(i, 8)),
      bit(7, 8),
      bit(8, 8),
      bit(8, 7),
      ...[9, 10, 11, 12, 13, 14].map((i) => bit(8, 14 - i)),
    ].reduce<number>((acc, b, i) => acc | (b << i), 0) ^ 0x5412;
  const level = (fmt >> 13) & 0b11;
  const mask = (fmt >> 10) & 0b111;
  expect(level).toBe(0b01); /* L */

  const MASKS = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number) => r % 2 === 0,
    (_r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  const reserved = reservedMask(version);
  const bits: number[] = [];
  let up = true;
  for (let right = n - 1; right > 0; right -= 2) {
    const col = right === 6 ? right - 1 : right;
    for (let step = 0; step < n; step++) {
      const r = up ? n - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (reserved[r][c]) continue;
        bits.push(MASKS[mask](r, c) ? bit(r, c) ^ 1 : bit(r, c));
      }
    }
    up = !up;
    if (right === 6) right--;
  }

  const words: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    words.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  /* De-interleave back into blocks, and keep only the data half. */
  const blocks = blocksOf(version);
  const out: number[][] = blocks.map(() => []);
  const widest = Math.max(...blocks.map((b) => b.size));
  let at = 0;
  for (let i = 0; i < widest; i++)
    for (let b = 0; b < blocks.length; b++) if (i < blocks[b].size) out[b].push(words[at++]);
  const data = out.flat();

  const stream = data.flatMap((w) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (w >> i) & 1));
  const take = (from: number, n2: number) =>
    stream.slice(from, from + n2).reduce((a, b) => (a << 1) | b, 0);
  expect(take(0, 4)).toBe(0b0100); /* byte mode */
  const cb = version < 10 ? 8 : 16;
  const len = take(4, cb);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = take(4 + cb + i * 8, 8);
  return new TextDecoder().decode(bytes);
}

describe("the capacity table", () => {
  /* The published data-codeword counts at level L. They are remembered
     separately from the error-correction table in qr.ts, and the module count
     they are compared against is *computed* from the layout — so the three
     agreeing is a real check on all three rather than a restatement. */
  // prettier-ignore
  const PUBLISHED = [
    19,34,55,80,108,136,156,194,232,274,324,370,428,461,523,589,647,721,795,861,
    932,1006,1094,1174,1276,
  ];

  it.each(PUBLISHED.map((d, i) => [i + 1, d]))("version %i holds %i data codewords", (v, d) => {
    expect(dataCodewords(v)).toBe(d);
  });

  it("splits a version's data over its blocks without losing a codeword", () => {
    for (let v = 1; v <= QR_MAX_VERSION; v++) {
      const blocks = blocksOf(v);
      expect(blocks.reduce((n, b) => n + b.size, 0)).toBe(dataCodewords(v));
      expect(blocks.reduce((n, b) => n + b.size + b.ec, 0)).toBe(totalCodewords(v));
      /* Blocks differ by at most one codeword — the specification's rule. */
      const sizes = blocks.map((b) => b.size);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("picks the smallest version that fits", () => {
    expect(versionFor(0)).toBe(1);
    expect(versionFor(17)).toBe(1);
    /* Version 1 holds 19 codewords, of which the mode and the count take two. */
    expect(versionFor(18)).toBe(2);
    expect(versionFor(1300)).toBeNull();
  });
});

describe("a symbol", () => {
  const CODE = packSdp("H", OFFER_SDP);

  it.each([
    ["nothing", ""],
    ["one character", "A"],
    ["a short line", "TUPATRO"],
    ["the last byte of version 1", "x".repeat(17)],
    ["the first byte of version 2", "x".repeat(18)],
    ["the ten-version boundary, where the count field grows", "x".repeat(272)],
    ["a whole invitation", CODE],
    ["a join link", `https://example.test/tupatro/#j=${CODE}`],
    ["Finnish, which is not ASCII", "Sinä ja Räikkönen — ässä ♠"],
  ])("reads back: %s", (_what, text) => {
    expect(read(qrMatrix(text))).toBe(text);
  });

  it("is the size its version says", () => {
    const m = qrMatrix("A");
    expect(m.length).toBe(qrSize(1));
    expect(m.length).toBe(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(qrMatrix(CODE).length).toBe(qrSize((qrMatrix(CODE).length - 17) / 4));
  });

  it("draws three finders, the timing patterns and the dark module", () => {
    const m = qrMatrix(CODE);
    const n = m.length;
    const finder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 7; c++) {
          const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          expect(m[r0 + r][c0 + c]).toBe(ring !== 2);
        }
    };
    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);
    /* And no fourth one where the alignment pattern lives. */
    for (let i = 8; i < n - 8; i++) {
      expect(m[6][i]).toBe(i % 2 === 0);
      expect(m[i][6]).toBe(i % 2 === 0);
    }
    expect(m[n - 8][8]).toBe(true);
  });

  it("writes the same format field twice", () => {
    const m = qrMatrix(CODE);
    const n = m.length;
    const b = (r: number, c: number) => (m[r][c] ? 1 : 0);
    const first = [
      ...[0, 1, 2, 3, 4, 5].map((i) => b(i, 8)),
      b(7, 8),
      b(8, 8),
      b(8, 7),
      ...[9, 10, 11, 12, 13, 14].map((i) => b(8, 14 - i)),
    ].reduce<number>((acc, x, i) => acc | (x << i), 0);
    const second = [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => b(8, n - 1 - i)),
      ...[8, 9, 10, 11, 12, 13, 14].map((i) => b(n - 15 + i, 8)),
    ].reduce<number>((acc, x, i) => acc | (x << i), 0);
    expect(second).toBe(first);
    /* And it is one of the eight the encoder can produce. */
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(formatBits)).toContain(first);
  });

  it("is the same symbol every time", () => {
    expect(qrMatrix(CODE)).toEqual(qrMatrix(CODE));
  });

  it("refuses what does not fit rather than truncating it", () => {
    expect(() => qrMatrix("x".repeat(2000))).toThrow(/does not fit/);
  });
});
