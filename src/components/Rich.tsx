/* A handful of catalogue strings emphasise a word: the rule a bullet is about,
   the number the player is short of. React escapes a string, so the <b> in the
   catalogue would print as literal text. This splits the string and builds the
   elements, which keeps the markup out of innerHTML — the same reason
   Interpolate exists. Tags never nest, and only <b> and <i> are recognised;
   anything else stays plain text. */
const MARKUP = /<(b|i)>([\s\S]*?)<\/\1>/g;

export function Rich({ text }: { text: string }) {
  /* Two capture groups, so split yields [text, tag, inner, text, tag, inner…]. */
  const parts = text.split(MARKUP);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 3 === 0) return part;
        /* The tag name itself; the inner text that follows renders it. */
        if (i % 3 === 1) return null;
        return parts[i - 1] === "b" ? <strong key={i}>{part}</strong> : <em key={i}>{part}</em>;
      })}
    </>
  );
}
