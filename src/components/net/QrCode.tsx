import { useMemo } from "react";
import { qrMatrix } from "../../net/qr";

/* An SVG, not a canvas: it is testable in jsdom, it prints, and it stays
   sharp when the player pinches to zoom — which is what somebody holding a
   phone to a laptop screen will do.

   One path of unit squares rather than one rect per module: a version 13
   symbol is 69x69, and 4761 elements is a DOM nobody needs. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { d, span } = useMemo(() => {
    const m = qrMatrix(text);
    const quiet = 4; /* the specification's margin; a scanner needs it */
    const parts: string[] = [];
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m.length; c++)
        if (m[r][c]) parts.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
    return { d: parts.join(""), span: m.length + quiet * 2 };
  }, [text]);

  return (
    <svg
      className="qr"
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="var(--qr-bg)" />
      <path d={d} fill="var(--qr-fg)" />
    </svg>
  );
}
