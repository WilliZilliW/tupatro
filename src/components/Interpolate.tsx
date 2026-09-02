import type { ReactNode } from "react";

/* Sometimes a translation needs a formatted value inside it (the bank in the
   shop's heading). The text is split and a React node goes in the
   placeholder's place, so this never needs dangerouslySetInnerHTML. */
export function Interpolate({ text, slots }: { text: string; slots: Record<string, ReactNode> }) {
  const parts = text.split(/\{(\w+)\}/g);
  return (
    <>
      {parts.map((part, i) =>
        /* An odd index is a placeholder's name. */
        i % 2 === 1 ? <span key={i}>{slots[part] ?? `{${part}}`}</span> : part,
      )}
    </>
  );
}
