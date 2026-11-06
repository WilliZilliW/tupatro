import { useState } from "react";
import { PX_HAND_MAX } from "../../game/constants";
import { PX_GROUP_NEED } from "../../game/content";
import { pxResolve, type PxPlay } from "../../game/politix";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { PolitixCard, PolitixIcon } from "../PolitixCard";
import { cx } from "../cx";
import { Hint } from "./Hint";
import type { PxCard, PxGroup, PxSpecial, Seat } from "../../game/types";

/* Politix's hand and its action bar. The selection (which cards, which group,
   whom each special is aimed at) is component-local, like SwapPanel's: it is a
   gesture in progress, never on GameState and never in a save. The bar sits
   here rather than on the felt so the cards and the controls that spend them
   share one piece of state without a context for it. */
export function PolitixHand() {
  const g = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const spectating = useSpectating();
  const { t, fmt, seatName } = useI18n();
  const [picked, setPicked] = useState<string[]>([]);
  const [groupSel, setGroupSel] = useState<PxGroup | null>(null);
  const [aims, setAims] = useState<Record<string, { target: Seat; remove?: string }>>({});
  const px = g.politix;
  if (!px) {
    return (
      <div className="handzone">
        <Hint />
      </div>
    );
  }

  const hand = px.hands[you];
  const myTurn = !spectating && g.seats[you] === "human" && px.turn === you && g.screen === null;
  const discarding = myTurn && g.phase === "pxdiscard";
  const playing = myTurn && g.phase === "pxturn";
  const chosen = hand.filter((c) => picked.includes(c.uid));
  const lockedTactic = chosen.find((c) => c.kind === "tactic")?.tactic ?? null;

  const toggle = (c: PxCard) => {
    if (!myTurn) return;
    if (picked.includes(c.uid)) return setPicked(picked.filter((u) => u !== c.uid));
    /* One tactic per play: a second tactic's cards are not offered once the
       first is locked in. */
    if (playing && c.kind === "tactic" && lockedTactic !== null && c.tactic !== lockedTactic)
      return;
    setPicked([...picked, c.uid]);
  };
  const reset = () => {
    setPicked([]);
    setGroupSel(null);
    setAims({});
  };

  const tableGroups: PxGroup[] = [];
  for (const v of px.table)
    if (v.group && !tableGroups.includes(v.group)) tableGroups.push(v.group);
  const group = groupSel && tableGroups.includes(groupSel) ? groupSel : (tableGroups[0] ?? null);

  const playCards = chosen.filter(
    (c) => c.kind === "coffee" || (c.kind === "tactic" && c.tactic === lockedTactic),
  );
  const specialCards = chosen.filter(
    (c) => c.kind === "scandal" || c.kind === "burnout" || c.kind === "news",
  );
  const removable = [
    ...px.scandals.flatMap((m, s) => m.map((c) => ({ c, s }))),
    ...px.burn.flatMap((c, s) => (c ? [{ c, s }] : [])),
  ];
  /* Seats of another party that play: the only legal aims of burnout and
     scandal. */
  const foes = ([1, 2, 3] as const)
    .map((i) => ((you + i) % 4) as Seat)
    .filter((s) => px.party[s] !== null && px.party[s] !== px.party[you]);
  const label = (c: PxCard) =>
    c.kind === "scandal"
      ? t("px.scandal", { group: t(`px.group.${c.group ?? "farmers"}`) })
      : t("px.burnout");
  const aimOf = (c: PxCard): { target: Seat; remove?: string } => {
    const own = aims[c.uid];
    if (own) return own;
    if (c.kind === "burnout") {
      const foe = foes.find((s) => px.burn[s] === null) ?? foes[0];
      return { target: foe ?? you };
    }
    if (c.kind === "scandal") return { target: foes[0] ?? you };
    if (c.kind === "news") return { target: you, remove: removable[0]?.c.uid };
    return { target: you };
  };
  const specials: PxSpecial[] = specialCards.map((c) => ({ uid: c.uid, ...aimOf(c) }));
  const play: PxPlay = {
    group: playCards.length > 0 ? group : null,
    tactic: playCards.length > 0 ? lockedTactic : null,
    cards: playCards.map((c) => c.uid),
    specials,
  };
  const res = playing ? pxResolve(g, you, play) : null;
  const burnt = px.burn[you] !== null;

  const doPlay = () => {
    dispatch({ type: "pxPlay", p: you, ...play });
    reset();
  };
  const doDraw = () => {
    dispatch({ type: "pxPass", p: you });
    reset();
  };
  const doRest = () => {
    dispatch({ type: "pxRest", p: you });
    reset();
  };
  const toThrow = hand.length - PX_HAND_MAX;
  const doDiscard = () => {
    dispatch({ type: "pxDiscard", p: you, uids: picked });
    reset();
  };

  return (
    <div className="handzone pxhandzone">
      {(playing || discarding) && (
        <div className={cx("pxbar", lockedTactic && `pxt-${lockedTactic}`)}>
          {discarding ? (
            <>
              <span>{t("px.discardNeed", { n: fmt(Math.max(0, toThrow - picked.length)) })}</span>
              <MoveButton
                className="btn"
                disabled={hand.length - picked.length !== PX_HAND_MAX}
                onClick={doDiscard}
              >
                {t("px.btn.discard")}
              </MoveButton>
            </>
          ) : (
            <>
              {playCards.length > 0 && (
                <label className="pxpick">
                  {t("px.pickGroup")}
                  <select
                    value={group ?? ""}
                    onChange={(e) => setGroupSel(e.target.value as PxGroup)}
                  >
                    {tableGroups.map((gr) => (
                      <option key={gr} value={gr}>
                        {t(`px.group.${gr}`)}
                        {lockedTactic ? ` (${fmt(PX_GROUP_NEED[gr][lockedTactic])})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {specialCards.map((c) => (
                <label className="pxpick" key={c.uid}>
                  {label(c)}
                  {c.kind === "news" ? (
                    <select
                      aria-label={t("px.removeWhat")}
                      value={aimOf(c).remove ?? ""}
                      onChange={(e) =>
                        setAims({ ...aims, [c.uid]: { target: you, remove: e.target.value } })
                      }
                    >
                      {removable.length === 0 && <option value="">{t("px.noRemovable")}</option>}
                      {removable.map(({ c: r, s }) => (
                        <option key={r.uid} value={r.uid}>
                          {label(r)} · {seatName(s as Seat, you)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      aria-label={t("px.pickTarget")}
                      value={aimOf(c).target}
                      onChange={(e) =>
                        setAims({ ...aims, [c.uid]: { target: Number(e.target.value) as Seat } })
                      }
                    >
                      {foes.map((s) => (
                        <option key={s} value={s}>
                          {seatName(s, you)}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ))}
              {res && playCards.length > 0 && (
                <>
                  {lockedTactic && <PolitixIcon name={lockedTactic} />}
                  <span className="pxpower">
                    {t("px.power", {
                      power: fmt(res.power ?? 0),
                      need: fmt(res.need ?? 0),
                    })}
                  </span>
                </>
              )}
              <MoveButton className="btn" disabled={!res || !res.ok} onClick={doPlay}>
                {t("px.btn.play")}
              </MoveButton>
              <MoveButton className="btn ghost" onClick={doDraw}>
                {t("px.btn.pass")}
              </MoveButton>
              {burnt && (
                <MoveButton className="btn ghost" onClick={doRest}>
                  {t("px.btn.rest")}
                </MoveButton>
              )}
            </>
          )}
        </div>
      )}
      <div className="handrow pxhandrow">
        {hand.map((c) => (
          <PolitixCard
            key={c.uid}
            card={c}
            selected={picked.includes(c.uid)}
            disabled={!myTurn}
            onClick={() => toggle(c)}
          />
        ))}
      </div>
      <Hint />
    </div>
  );
}
