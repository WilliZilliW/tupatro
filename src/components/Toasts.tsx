import { useGameState } from "../hooks/useGame";
import { useI18n } from "../i18n/useI18n";

/* A toast is carried in the state as a key; the translation happens only
   here. The suit is inflected into the partitive, and a data row's name comes
   from nameOf. */
export function Toasts() {
  const { toast } = useGameState();
  const { t, nameOf } = useI18n();
  if (!toast) return null;

  const vars: Record<string, string | number> = { ...toast.vars };
  if (toast.suit) vars.suit = t(`suitPart.${toast.suit}`);
  if (toast.nameKey) vars.name = nameOf({ key: toast.nameKey });

  return (
    <div className="toast" key={toast.id} role="status">
      {t(toast.key as Parameters<typeof t>[0], vars)}
    </div>
  );
}
