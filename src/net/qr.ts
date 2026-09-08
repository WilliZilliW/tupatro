/* ============================ a QR code, by hand ============================
   The invitation is a few hundred characters, and the shortest way to move it
   from a laptop to a phone is to hold it up to a camera. That needs an
   encoder; it does not need a dependency. This is byte mode at error
   correction level L, versions 1 to 25 — enough for any code this project
   produces, and nothing more.

   Encoding only. Reading one back is a camera permission, a video pipeline
   and a much larger algorithm, and the phone's own camera app already does it:
   the code travels as a link (see joinLink in signal.ts), so scanning it opens
   the game with the invitation in the box.

   Everything here is the QR specification's arithmetic (ISO/IEC 18004) and
   none of it is this project's invention, which is why the comments name the
   parts rather than justify them. Two things are worth knowing before
   changing any of it:

   - The three remembered tables are the error-correction block layout and the
     alignment-pattern centres. Everything else — how many codewords a version
     holds, how a block splits — is computed from the geometry, and a test
     asserts the two agree. A misremembered number breaks that identity rather
     than producing a symbol that only fails in a camera.
   - qr.test.ts contains a reader. A round trip through it proves the module
     placement, the masking and the format bits; it cannot prove the
     Reed-Solomon table, because it does not use it. That is checked once
     against an outside decoder and recorded in the spec. */

export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 25;

/* [error-correction codewords per block, number of blocks] at level L,
   indexed by version - 1. */
// prettier-ignore
const EC_L: [number, number][] = [
  [7,1],[10,1],[15,1],[20,1],[26,1],[18,2],[20,2],[24,2],[30,2],[18,4],
  [20,4],[24,4],[26,4],[30,4],[22,6],[24,6],[28,6],[30,6],[28,7],[28,8],
  [28,8],[28,9],[30,9],[30,10],[26,12],
];

/* Alignment pattern centre coordinates, indexed by version - 1. */
// prettier-ignore
const ALIGN: number[][] = [
  [],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],
  [6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],
  [6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],
  [6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],
];

export const qrSize = (version: number): number => version * 4 + 17;

/* Which modules the function patterns own. Exported for the reader in
   qr.test.ts, which has to walk the same holes this encoder filled. */
export const reservedMask = (version: number): boolean[][] => frame(version).reserved;

/* ==================== GF(256) ====================
   The Reed-Solomon field, primitive polynomial 0x11d. Built once, in an
   expression, because a module-level `let` is state the reducer cannot see —
   the project bans them outright. */
const GF = (() => {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  return { exp, log };
})();

const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : GF.exp[GF.log[a] + GF.log[b]];

/* The generator polynomial for `n` error-correction codewords:
   (x - a^0)(x - a^1)…(x - a^(n-1)). */
function generator(n: number): number[] {
  const g = [1];
  for (let i = 0; i < n; i++) {
    g.push(0);
    for (let j = g.length - 1; j > 0; j--) g[j] ^= gfMul(g[j - 1], GF.exp[i]);
  }
  return g;
}

function ecCodewords(data: number[], n: number): number[] {
  const g = generator(n);
  const out = new Array<number>(n).fill(0);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift();
    out.push(0);
    for (let i = 0; i < n; i++) out[i] ^= gfMul(g[i + 1], factor);
  }
  return out;
}

/* ==================== how much fits ====================
   The number of codewords a version holds is the number of modules left over
   once the function patterns are placed, divided by eight. Counting them from
   the layout rather than from a table is what lets the block table above be
   checked instead of trusted. */
export function totalCodewords(version: number): number {
  const { reserved } = frame(version);
  let free = 0;
  for (const row of reserved) for (const cell of row) if (!cell) free++;
  return Math.floor(free / 8);
}

export const dataCodewords = (version: number): number =>
  totalCodewords(version) - EC_L[version - 1][0] * EC_L[version - 1][1];

/* A version's blocks: the remainder is spread over the last blocks, one extra
   codeword each. This is the specification's rule, not a table. */
export function blocksOf(version: number): { size: number; ec: number }[] {
  const [ec, count] = EC_L[version - 1];
  const data = dataCodewords(version);
  const short = Math.floor(data / count);
  const long = data % count;
  return Array.from({ length: count }, (_, i) => ({
    size: i < count - long ? short : short + 1,
    ec,
  }));
}

const countBits = (version: number): number => (version < 10 ? 8 : 16);

export function versionFor(byteLength: number): number | null {
  for (let v = QR_MIN_VERSION; v <= QR_MAX_VERSION; v++)
    if (4 + countBits(v) + byteLength * 8 <= dataCodewords(v) * 8) return v;
  return null;
}

/* ==================== the bit stream ==================== */
function codewordsFor(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); /* byte mode */
  push(bytes.length, countBits(version));
  for (const b of bytes) push(b, 8);

  const capacity = dataCodewords(version) * 8;
  /* Terminator: up to four zeroes, then out to a byte boundary. */
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
  /* The two pad codewords, alternating, to the end of the capacity. */
  const PAD = [0xec, 0x11];
  while (data.length < dataCodewords(version)) data.push(PAD[data.length % 2]);

  /* Split into blocks, then interleave: all the blocks' first data codeword,
     then all their second, and the same again for the error correction. */
  const blocks = blocksOf(version);
  const parts = blocks.map((b, i) => {
    const from = blocks.slice(0, i).reduce((n, x) => n + x.size, 0);
    const chunk = data.slice(from, from + b.size);
    return { data: chunk, ec: ecCodewords(chunk, b.ec) };
  });

  const out: number[] = [];
  const widest = Math.max(...parts.map((p) => p.data.length));
  for (let i = 0; i < widest; i++)
    for (const p of parts) if (i < p.data.length) out.push(p.data[i]);
  const ecLen = blocks[0].ec;
  for (let i = 0; i < ecLen; i++) for (const p of parts) out.push(p.ec[i]);
  return out;
}

/* ==================== the frame ====================
   The function patterns, and a mask of which modules they occupy. Data is
   placed only where `reserved` is false. */
function frame(version: number): { grid: number[][]; reserved: boolean[][] } {
  const n = qrSize(version);
  const grid = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const reserved = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const set = (r: number, c: number, v: number) => {
    grid[r][c] = v;
    reserved[r][c] = true;
  };

  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const r1 = r0 + r;
        const c1 = c0 + c;
        if (r1 < 0 || c1 < 0 || r1 >= n || c1 >= n) continue;
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(r1, c1, r >= 0 && r <= 6 && c >= 0 && c <= 6 && ring !== 2 ? 1 : 0);
      }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);

  /* Timing patterns, and the dark module below the top-left finder. */
  for (let i = 8; i < n - 8; i++) {
    set(6, i, i % 2 === 0 ? 1 : 0);
    set(i, 6, i % 2 === 0 ? 1 : 0);
  }
  set(n - 8, 8, 1);

  for (const r of ALIGN[version - 1])
    for (const c of ALIGN[version - 1]) {
      /* Not over a finder. */
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++)
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0);
    }

  /* The format information's two copies, filled in once the mask is known. */
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) set(8, i, 0);
    if (!reserved[i][8]) set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][n - 1 - i]) set(8, n - 1 - i, 0);
    if (!reserved[n - 1 - i][8]) set(n - 1 - i, 8, 0);
  }

  /* The version information, from version 7 up. */
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const b = (bits >> i) & 1;
      set(Math.floor(i / 3), n - 11 + (i % 3), b);
      set(n - 11 + (i % 3), Math.floor(i / 3), b);
    }
  }
  return { grid, reserved };
}

/* BCH(18,6), generator 0x1f25. */
export function versionBits(version: number): number {
  let rem = version << 12;
  for (let i = 0; i < 12; i++) if ((rem >> (17 - i)) & 1) rem ^= 0x1f25 << (5 - i);
  return (version << 12) | rem;
}

/* BCH(15,5) over the five bits of level and mask, masked with 0x5412 so the
   all-zero case is not a blank field. Level L is 0b01. */
export function formatBits(mask: number): number {
  const value = (0b01 << 3) | mask;
  let rem = value << 10;
  for (let i = 0; i < 5; i++) if ((rem >> (14 - i)) & 1) rem ^= 0x537 << (4 - i);
  return ((value << 10) | rem) ^ 0x5412;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/* The zigzag: two columns at a time from the bottom right, upwards then
   downwards, skipping the vertical timing column. */
function placeData(grid: number[][], reserved: boolean[][], words: number[], mask: number): void {
  const n = grid.length;
  const bits: number[] = [];
  for (const w of words) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);

  let at = 0;
  let up = true;
  for (let right = n - 1; right > 0; right -= 2) {
    const col = right === 6 ? right - 1 : right; /* the timing column is skipped whole */
    for (let step = 0; step < n; step++) {
      const r = up ? n - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (reserved[r][c]) continue;
        const bit = at < bits.length ? bits[at++] : 0;
        grid[r][c] = MASKS[mask](r, c) ? bit ^ 1 : bit;
      }
    }
    up = !up;
    if (right === 6) right--; /* skip the column the timing pattern owns */
  }
}

/* The format field, twice.

   The two copies do not have the same shape, and they are not transposes of
   each other either: the first runs *down column 8* and then left along row
   8, while the second runs right along row 8 and then *down column 8*. Get
   that backwards and the symbol still reads perfectly in a reader that shares
   the mistake — which is exactly what happened here, and what an outside
   decoder is for. */
function placeFormat(grid: number[][], mask: number): void {
  const n = grid.length;
  const bits = formatBits(mask);
  const at = (i: number) => (bits >> i) & 1;

  /* First copy: bits 0-5 down column 8, then over the corner and left. */
  for (let i = 0; i <= 5; i++) grid[i][8] = at(i);
  grid[7][8] = at(6);
  grid[8][8] = at(7);
  grid[8][7] = at(8);
  for (let i = 9; i <= 14; i++) grid[8][14 - i] = at(i);

  /* Second copy: bits 0-7 right along row 8, bits 8-14 down column 8. The
     dark module at (n-8, 8) is not one of the fifteen. */
  for (let i = 0; i <= 7; i++) grid[8][n - 1 - i] = at(i);
  for (let i = 8; i <= 14; i++) grid[n - 15 + i][8] = at(i);
  grid[n - 8][8] = 1;
}

/* The four penalty rules, which is how the mask is chosen. */
export function penalty(grid: number[][]): number {
  const n = grid.length;
  let score = 0;

  const run = (get: (i: number, j: number) => number) => {
    for (let i = 0; i < n; i++) {
      let same = 1;
      for (let j = 1; j < n; j++) {
        if (get(i, j) === get(i, j - 1)) same++;
        else {
          if (same >= 5) score += same - 2;
          same = 1;
        }
      }
      if (same >= 5) score += same - 2;
    }
  };
  run((i, j) => grid[i][j]);
  run((i, j) => grid[j][i]);

  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
    }

  /* 1011101 with four light modules on either side, in both directions. */
  const FIND = [1, 0, 1, 1, 1, 0, 1];
  const LIGHT = [0, 0, 0, 0];
  const matches = (line: number[], at: number, pat: number[]) =>
    pat.every((p, i) => line[at + i] === p);
  const scan = (line: number[]) => {
    for (let i = 0; i + 7 <= line.length; i++) {
      if (!matches(line, i, FIND)) continue;
      const before = i >= 4 && matches(line, i - 4, LIGHT);
      const after = i + 11 <= line.length && matches(line, i + 7, LIGHT);
      if (before || after) score += 40;
    }
  };
  for (let i = 0; i < n; i++) {
    scan(grid[i]);
    scan(grid.map((row) => row[i]));
  }

  const dark = grid.flat().reduce((a, b) => a + b, 0);
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/* One symbol at one mask. Exported because a comparison against an outside
   encoder is only readable when both are told which mask to use — the mask is
   chosen by a penalty score, and two encoders that disagree by one point
   produce two entirely different pictures of the same data. */
export function qrMatrixWith(text: string, mask: number): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = versionFor(bytes.length);
  if (version === null)
    throw new Error(`qr: ${bytes.length} bytes does not fit version ${QR_MAX_VERSION}`);
  const { grid, reserved } = frame(version);
  placeData(grid, reserved, codewordsFor(bytes, version), mask);
  placeFormat(grid, mask);
  return grid.map((row) => row.map((v) => v === 1));
}

/* The whole encoder: text in, modules out. `true` is a dark module. The mask
   is the one of the eight with the lowest penalty. */
export function qrMatrix(text: string): boolean[][] {
  const best = { score: Infinity, grid: [] as boolean[][] };
  for (let mask = 0; mask < 8; mask++) {
    const grid = qrMatrixWith(text, mask);
    const score = penalty(grid.map((row) => row.map((v) => (v ? 1 : 0))));
    if (score < best.score) {
      best.score = score;
      best.grid = grid;
    }
  }
  return best.grid;
}
