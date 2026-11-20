import type { PxCard, PxGroup } from "../../game/types";

/* One face of a seat's fan. Identical scandals are identical in effect (each
   moves the same group by the same delta), so they share a face and a count. */
export type PxPileFace = {
  kind: "burnout" | "scandal";
  group: PxGroup | null;
  count: number;
  uid: string;
};

/* The burnout first, then the scandals grouped by group in first-seen order.
   Pure: no React, no text, and the inputs are only read. */
export function pxPileFaces(burn: PxCard | null, scandals: PxCard[]): PxPileFace[] {
  const faces: PxPileFace[] = [];
  if (burn) faces.push({ kind: "burnout", group: null, count: 1, uid: burn.uid });
  for (const c of scandals) {
    const same = faces.find((f) => f.kind === "scandal" && f.group === c.group);
    if (same) same.count += 1;
    else faces.push({ kind: "scandal", group: c.group, count: 1, uid: c.uid });
  }
  return faces;
}
