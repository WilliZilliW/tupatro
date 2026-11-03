import { cx } from "./cx";
import { useI18n } from "../i18n/useI18n";
import type { PxCard } from "../game/types";

/* Original inline shapes, drawn in currentColor so the stylesheet colours
   them. No publisher art and no new text glyph (a glyph needs a tofu probe). */
export type PxIconName =
  "argue" | "evade" | "charm" | "growl" | "coffee" | "mod" | "burnout" | "news";

export function PolitixIcon({ name }: { name: PxIconName }) {
  const common = {
    width: "2.2em",
    height: "2.2em",
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "argue":
      return (
        <svg {...common}>
          <path d="M5 7h22v14H15l-6 5v-5H5z" />
          <path d="M10 12h12M10 16h8" />
        </svg>
      );
    case "evade":
      return (
        <svg {...common}>
          <path d="M6 22c0-9 8-14 18-12" />
          <path d="M19 5l5 5-5 5" />
        </svg>
      );
    case "charm":
      return (
        <svg {...common}>
          <path d="M16 27C6 20 4 13 8 9c3-3 7-1 8 2 1-3 5-5 8-2 4 4 2 11-8 18z" />
        </svg>
      );
    case "growl":
      return (
        <svg {...common}>
          <path d="M4 22l5-12 5 9 4-13 4 16 6-8" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...common}>
          <path d="M6 12h16v8a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
          <path d="M22 14h3a3 3 0 0 1 0 6h-3M11 4v4M16 4v4" />
        </svg>
      );
    case "mod":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M10 16h12M16 10v12" />
        </svg>
      );
    case "burnout":
      return (
        <svg {...common}>
          <path d="M16 4c1 6 8 8 8 15a8 8 0 0 1-16 0c0-4 3-6 4-9 2 2 3 3 4-6z" />
        </svg>
      );
    case "news":
      return (
        <svg {...common}>
          <rect x="5" y="6" width="22" height="20" rx="2" />
          <path d="M10 12h12M10 17h12M10 22h7" />
        </svg>
      );
  }
}

/* One action card. The label is rendered in the viewer's language. */
export function PolitixCard({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: PxCard;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const { t } = useI18n();
  const icon: PxIconName = card.kind === "tactic" ? (card.tactic ?? "argue") : card.kind;
  const label =
    card.kind === "tactic"
      ? t(`px.tactic.${card.tactic ?? "argue"}`)
      : card.kind === "mod"
        ? t("px.mod", {
            delta: card.delta > 0 ? "+1" : "−1",
            group: t(`px.group.${card.group ?? "farmers"}`),
          })
        : t(
            card.kind === "coffee"
              ? "px.coffee"
              : card.kind === "burnout"
                ? "px.burnout"
                : "px.news",
          );
  return (
    <button
      type="button"
      data-uid={card.uid}
      className={cx(
        "pxcard",
        `pxk-${card.kind}`,
        card.tactic && `pxt-${card.tactic}`,
        selected && "selected",
      )}
      disabled={disabled}
      aria-pressed={selected ?? false}
      onClick={onClick}
    >
      <PolitixIcon name={icon} />
      <span className="pxlabel">{label}</span>
    </button>
  );
}
