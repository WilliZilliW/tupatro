import { cx } from "./cx";
import { useI18n } from "../i18n/useI18n";
import type { PxCard, PxGroup, PxTactic } from "../game/types";

/* Original inline shapes, drawn in currentColor so the stylesheet colours
   them. No publisher art and no new text glyph (a glyph needs a tofu probe). */
export type PxIconName =
  | "argue"
  | "evade"
  | "charm"
  | "growl"
  | "coffee"
  | "burnout"
  | "news"
  | "scandal"
  | "suv"
  | "tractor"
  | "bus"
  | PxGroup;

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
    case "scandal":
      return (
        <svg {...common}>
          <path d="M16 4l13 23H3z" />
          <path d="M16 12v7M16 23v1" />
        </svg>
      );
    case "suv":
      return (
        <svg {...common}>
          <path d="M3 21v-6l4-6h13l5 6h4v6z" />
          <circle cx="9" cy="22" r="3" />
          <circle cx="23" cy="22" r="3" />
          <path d="M12 9v6" />
        </svg>
      );
    case "tractor":
      return (
        <svg {...common}>
          <path d="M14 21V8h-5l-2 8H3v5" />
          <circle cx="9" cy="22" r="4" />
          <circle cx="25" cy="23" r="3" />
          <path d="M14 15h8l2 8" />
        </svg>
      );
    case "bus":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="26" height="16" rx="3" />
          <path d="M3 15h26M10 7v8M19 7v8" />
          <circle cx="9" cy="25" r="2" />
          <circle cx="23" cy="25" r="2" />
        </svg>
      );
    case "farmers":
      return (
        <svg {...common}>
          <path d="M16 28V14" />
          <path d="M16 14c-5-1-7-5-6-9 5 1 7 4 6 9zM16 14c5-1 7-5 6-9-5 1-7 4-6 9z" />
          <path d="M16 21c-5 0-8-3-8-7 5 0 8 3 8 7zM16 21c5 0 8-3 8-7-5 0-8 3-8 7z" />
          <path d="M9 28h14" />
        </svg>
      );
    case "workers":
      return (
        <svg {...common}>
          <path d="M9 27L21 15" />
          <path d="M19 6a6 6 0 0 0 0 9l3-3 3 0 0-3z" />
          <circle cx="8" cy="26" r="1.6" />
        </svg>
      );
    case "whitecollar":
      return (
        <svg {...common}>
          <rect x="4" y="11" width="24" height="16" rx="2" />
          <path d="M12 11V7h8v4M4 18h24M14 18v3h4v-3" />
        </svg>
      );
    case "youth":
      return (
        <svg {...common}>
          <path d="M7 20v-4a9 9 0 0 1 18 0v4" />
          <rect x="4" y="18" width="6" height="9" rx="2" />
          <rect x="22" y="18" width="6" height="9" rx="2" />
        </svg>
      );
    case "blondes":
      return (
        <svg {...common}>
          <circle cx="16" cy="12" r="8" />
          <path d="M12 9c3 0 5-1 7-3M10 14c2 0 4 0 6-1" />
          <path d="M16 20v8M12 28h8" />
        </svg>
      );
    case "hippies":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="3" />
          <circle cx="16" cy="7" r="3.4" />
          <circle cx="16" cy="25" r="3.4" />
          <circle cx="7" cy="16" r="3.4" />
          <circle cx="25" cy="16" r="3.4" />
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

/* One aspect chip: the aspect's icon and a number, coloured by --px-aspect.
   The words live on the row's aria-label, not on the chip. */
export function PxChip({ tactic, text }: { tactic: PxTactic; text: string }) {
  return (
    <span className={cx("pxchip", `pxt-${tactic}`)}>
      <PolitixIcon name={tactic} />
      {text}
    </span>
  );
}

/* A card's label in the viewer's language. */
function useCardLabel() {
  const { t } = useI18n();
  return (card: PxCard) =>
    card.kind === "tactic"
      ? t(`px.tactic.${card.tactic ?? "argue"}`)
      : card.kind === "scandal"
        ? t("px.scandal", { group: t(`px.group.${card.group ?? "farmers"}`) })
        : t(
            card.kind === "coffee"
              ? "px.coffee"
              : card.kind === "burnout"
                ? "px.burnout"
                : "px.news",
          );
}

/* A small, non-interactive card lying in front of a seat on the felt. */
export function PolitixMiniFace({ card }: { card: PxCard }) {
  const label = useCardLabel();
  return (
    <span
      className={cx(
        "pxmini",
        `pxk-${card.kind}`,
        card.kind === "scandal" && `pxg-${card.group ?? "farmers"}`,
      )}
    >
      <PolitixIcon name={card.kind === "scandal" ? "scandal" : "burnout"} />
      <span className="pxlabel">{label(card)}</span>
    </span>
  );
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
  const label = useCardLabel();
  const icon: PxIconName = card.kind === "tactic" ? (card.tactic ?? "argue") : card.kind;
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
      <span className="pxband" />
      <PolitixIcon name={icon} />
      <span className="pxlabel">{label(card)}</span>
    </button>
  );
}
