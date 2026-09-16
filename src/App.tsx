import { useState } from "react";
import { Hand } from "./components/hand/Hand";
import { Rail } from "./components/rail/Rail";
import { NetBanner } from "./components/net/NetBanner";
import { Screens } from "./components/screens/Screens";
import { Table } from "./components/table/Table";
import { PrivateTable } from "./components/table/PrivateTable";
import { Toasts } from "./components/Toasts";
import { useNet, useSpectating } from "./hooks/useNet";
import { useI18n } from "./i18n/useI18n";

export function App() {
  /* The shared table shows nothing that belongs to one player, and a hand is
     the first of those things. */
  const spectating = useSpectating();
  const net = useNet();
  const { t } = useI18n();
  /* The escape hatch: window-local, never on GameState, never saved and never
     synchronised between peers, so a reload or a new match starts on the
     private view again while a display is connected. */
  const [showBoard, setShowBoard] = useState(false);
  /* A shared table window is unaffected — useSpectating() wins over this —
     and so is every offline window, where tableHere is false. */
  const privateMode = net.live && net.tableHere && !spectating;

  return (
    <>
      <div id="app">
        <Rail />
        {privateMode && !showBoard ? (
          <PrivateTable onShowBoard={() => setShowBoard(true)} />
        ) : (
          <Table />
        )}
        {!spectating && <Hand />}
      </div>
      {/* Kept outside #app, the same way NetBanner is: a fourth direct child
          of the grid would be auto-placed into Hand's own cell rather than
          floating over it. The toggle survives the swap back to the felt, so
          the same click that showed it can hide it again. */}
      {privateMode && showBoard && (
        <div className="privbar float">
          <p>{t("priv.note")}</p>
          <button type="button" onClick={() => setShowBoard(false)}>
            {t("btn.hideBoard")}
          </button>
        </div>
      )}
      <Screens />
      {/* Above Screens on purpose: .overlay is fixed and inset:0, so a
          warning drawn underneath one is a warning nobody sees — and "the peers are no
          longer in step" has to arrive even while a result screen is up. */}
      <NetBanner />
      <Toasts />
    </>
  );
}
