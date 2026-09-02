/* Joins class names. Falsy values drop out, so conditions can be written
   inline: cx("card", red && "red"). */
export function cx(...parts: Array<string | number | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}
