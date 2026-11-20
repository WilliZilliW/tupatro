import { describe, expect, it } from "vitest";
import { pxPileFaces } from "./pxPile";
import type { PxCard, PxGroup } from "../../game/types";

const burn: PxCard = { uid: "b", kind: "burnout", tactic: null, group: null };
const sc = (uid: string, group: PxGroup): PxCard => ({ uid, kind: "scandal", tactic: null, group });

describe("pxPileFaces", () => {
  it("is empty for nothing", () => expect(pxPileFaces(null, [])).toEqual([]));

  it("draws a burnout alone as one face", () => {
    expect(pxPileFaces(burn, [])).toEqual([{ kind: "burnout", group: null, count: 1, uid: "b" }]);
  });

  it("groups the worst pile", () => {
    const f = pxPileFaces(burn, [
      sc("1", "hippies"),
      sc("2", "hippies"),
      sc("3", "blondes"),
      sc("4", "youth"),
    ]);
    expect(f.map((x) => [x.kind, x.group, x.count])).toEqual([
      ["burnout", null, 1],
      ["scandal", "hippies", 2],
      ["scandal", "blondes", 1],
      ["scandal", "youth", 1],
    ]);
  });

  it("keeps first-seen order and the first card's uid", () => {
    const f = pxPileFaces(null, [sc("a", "youth"), sc("b", "hippies"), sc("c", "youth")]);
    expect(f.map((x) => [x.group, x.count, x.uid])).toEqual([
      ["youth", 2, "a"],
      ["hippies", 1, "b"],
    ]);
  });

  it("does not mutate its input", () => {
    const list = [sc("a", "youth"), sc("b", "youth")];
    const copy = structuredClone(list);
    pxPileFaces(burn, list);
    expect(list).toEqual(copy);
  });
});
