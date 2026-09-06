import { describe, expect, it } from "vitest";
import { chipValue } from "./cards";
import { comboOk, isRun, isSet, pipTotal, pipValue, validateLay } from "./laydown";
import { st } from "../test/factories";
import { card } from "../test/factories";

describe("pip value", () => {
  it("is the rank, not the chip value", () => {
    const ace = card("S", 14);
    /* The mutation this guards: aliasing pipValue to chipValue. On the same
       card object the two disagree, so the divergence is asserted rather than
       assumed. */
    expect(pipValue(ace)).toBe(14);
    expect(chipValue(st(), ace)).toBe(11);
    expect(pipValue(ace)).not.toBe(chipValue(st(), ace));
  });

  it.each([
    [14, 14],
    [13, 13],
    [12, 12],
    [11, 11],
    [7, 7],
    [2, 2],
  ])("scores rank %i as %i", (r, pips) => {
    expect(pipValue(card("H", r))).toBe(pips);
  });

  it("sums a combination", () => {
    expect(pipTotal([card("S", 11), card("H", 11), card("D", 11)])).toBe(33);
  });
});

describe("a set", () => {
  it("is three cards of one rank in different suits", () => {
    expect(isSet([card("S", 11), card("H", 11), card("D", 11)])).toBe(true);
  });

  it("is four of them too", () => {
    expect(isSet([card("S", 11), card("H", 11), card("D", 11), card("C", 11)])).toBe(true);
  });

  it("is not two", () => {
    /* Two aces, which any length check loosened to >= 2 would accept. */
    expect(isSet([card("S", 14), card("H", 14)])).toBe(false);
  });

  it("is not three cards with a suit repeated", () => {
    /* Two distinct uids, one suit: the side deck can hold a duplicate, so the
       distinctness has to be checked on the suit rather than assumed from the
       deck. */
    const a = card("S", 11);
    const b = card("S", 11);
    expect(a.uid).not.toBe(b.uid);
    expect(isSet([a, b, card("H", 11)])).toBe(false);
  });

  it("is not a mixed rank", () => {
    expect(isSet([card("S", 11), card("H", 11), card("D", 12)])).toBe(false);
  });
});

describe("a run", () => {
  it("is three or more consecutive cards of one suit", () => {
    expect(isRun([card("H", 3), card("H", 4), card("H", 5)])).toBe(true);
    expect(isRun([card("H", 3), card("H", 4), card("H", 5), card("H", 6)])).toBe(true);
  });

  it("does not care what order it arrives in", () => {
    expect(isRun([card("H", 5), card("H", 3), card("H", 4)])).toBe(true);
  });

  it("is not two cards", () => {
    expect(isRun([card("H", 4), card("H", 5)])).toBe(false);
  });

  it("is not a gap", () => {
    /* The mutation check: relax the consecutiveness in isRun and this is what
       fails. Every card here is one suit and the ranks ascend, so nothing but
       the step check can reject it. */
    expect(isRun([card("H", 3), card("H", 5), card("H", 7)])).toBe(false);
  });

  it("is not two suits", () => {
    expect(isRun([card("H", 3), card("S", 4), card("H", 5)])).toBe(false);
  });

  it("runs up to the ace but never through it", () => {
    /* A rank is only ever 2..14 and an ace is only ever 14, so Q-K-A is a run
       and nothing wraps. No wrap check exists, and these are why none is
       needed. */
    expect(isRun([card("D", 12), card("D", 13), card("D", 14)])).toBe(true);
    expect(isRun([card("D", 14), card("D", 2), card("D", 3)])).toBe(false);
    expect(isRun([card("D", 13), card("D", 14), card("D", 2)])).toBe(false);
  });

  it("is a combination, as is a set", () => {
    expect(comboOk([card("D", 12), card("D", 13), card("D", 14)])).toBe(true);
    expect(comboOk([card("S", 9), card("H", 9), card("C", 9)])).toBe(true);
    expect(comboOk([card("S", 9), card("H", 4), card("C", 2)])).toBe(false);
  });
});

describe("the requirement's worked examples", () => {
  it("scores three jacks as 33", () => {
    const jacks = [card("S", 11), card("H", 11), card("D", 11)];
    const res = validateLay([], jacks, [jacks.map((c) => c.uid)]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(pipTotal(res.laid)).toBe(33);
  });

  it("scores a six added to 3-4-5 of hearts as 6", () => {
    const run = [card("H", 3), card("H", 4), card("H", 5)];
    const six = card("H", 6);
    const res = validateLay([run], [six], [[...run.map((c) => c.uid), six.uid]]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(pipTotal(res.laid)).toBe(6);
    expect(res.laid.map((c) => c.uid)).toEqual([six.uid]);
  });
});

describe("validateLay", () => {
  const run = [card("H", 3), card("H", 4), card("H", 5)];
  const uids = (cards: { uid: string }[]) => cards.map((c) => c.uid);
  const keyOf = (r: ReturnType<typeof validateLay>) => (r.ok ? "ok" : r.key);

  it("rejects a uid that is neither in hand nor on the table", () => {
    expect(keyOf(validateLay([], [card("S", 2)], [["nosuchuid"]]))).toBe("toast.layUnknownCard");
  });

  it("rejects the same uid twice", () => {
    const set = [card("S", 9), card("H", 9), card("C", 9)];
    expect(keyOf(validateLay([], set, [[...uids(set), set[0].uid]]))).toBe("toast.layDuplicate");
  });

  it("rejects a proposal that leaves a table card behind", () => {
    const fresh = [card("S", 9), card("H", 9), card("C", 9)];
    expect(keyOf(validateLay([run], fresh, [uids(fresh)]))).toBe("toast.layTableCardMissing");
  });

  it("rejects a row that is neither a set nor a run", () => {
    const junk = [card("S", 9), card("H", 4), card("C", 2)];
    expect(keyOf(validateLay([], junk, [uids(junk)]))).toBe("toast.layIllegalCombo");
  });

  it("rejects two new cards added to a row already on the table", () => {
    /* Two, not one: a test that added a single card would pass with the cap
       relaxed to two and catch nothing. */
    const six = card("H", 6);
    const seven = card("H", 7);
    const res = validateLay([run], [six, seven], [[...uids(run), six.uid, seven.uid]]);
    expect(keyOf(res)).toBe("toast.layOneCard");
  });

  it("allows one new card on a table row and three new ones in a fresh row", () => {
    const six = card("H", 6);
    const set = [card("S", 9), card("H", 9), card("C", 9)];
    const res = validateLay([run], [six, ...set], [[...uids(run), six.uid], uids(set)]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(pipTotal(res.laid)).toBe(6 + 27);
  });

  it("rejects a turn that lays nothing", () => {
    expect(keyOf(validateLay([run], [card("S", 2)], [uids(run)]))).toBe("toast.layNothing");
  });

  it("lets the table be rearranged as long as nothing leaves it", () => {
    /* 3-4-5-6-7 of hearts split into two rows is legal: the cards are all
       still there and both halves are runs. The eight is what makes it a
       turn rather than a no-op. */
    const long = [card("H", 3), card("H", 4), card("H", 5), card("H", 6), card("H", 7)];
    const eight = card("H", 8);
    const res = validateLay(
      [long],
      [eight],
      [uids(long.slice(0, 3)), [...uids(long.slice(3)), eight.uid]],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.table).toHaveLength(2);
    expect(pipTotal(res.laid)).toBe(8);
  });

  it("returns the table as it would stand", () => {
    const set = [card("S", 9), card("H", 9), card("C", 9)];
    const res = validateLay([], set, [uids(set)]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.table.map(uids)).toEqual([uids(set)]);
  });
});
