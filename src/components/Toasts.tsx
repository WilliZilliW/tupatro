import { useGameState } from "../hooks/useGame";
import { useSpectating } from "../hooks/useNet";
import { useViewSeat } from "../hooks/useSeat";
import { useI18n } from "../i18n/useI18n";

/* A toast is carried in the state as a key; the translation happens only
   here. The suit is inflected into the partitive, and a data row's name comes
   from nameOf.

   Addressed toasts (toast.p set) are a rule, not tidiness: a temppu's effect
   toast must not tell the other seats what was just spent — broadcasting
   toast.theftArmed would tell the opponents the next trick is stolen. A
   window draws nothing for a toast addressed to a seat that is not its own,
   and the shared table draws none of them at all. */
export function Toasts() {
  const { toast } = useGameState();
  const { t, nameOf } = useI18n();
  const you = useViewSeat();
  const spectating = useSpectating();
  if (!toast) return null;
  if (toast.p !== undefined && (spectating || toast.p !== you)) return null;

  const vars: Record<string, string | number> = { ...toast.vars };
  if (toast.suit) vars.suit = t(`suitPart.${toast.suit}`);
  if (toast.nameKey) vars.name = nameOf({ key: toast.nameKey });

  return (
    <div className="toast" key={toast.id} role="status">
      {t(toast.key as Parameters<typeof t>[0], vars)}
    </div>
  );
}
