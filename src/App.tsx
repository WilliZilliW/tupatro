import { Hand } from "./components/hand/Hand";
import { Rail } from "./components/rail/Rail";
import { NetBanner } from "./components/net/NetBanner";
import { Screens } from "./components/screens/Screens";
import { Table } from "./components/table/Table";
import { Toasts } from "./components/Toasts";

export function App() {
  return (
    <>
      <div id="app">
        <Rail />
        <Table />
        <Hand />
      </div>
      <Screens />
      {/* Above Screens on purpose: .overlay is fixed and inset:0, so a warning
          drawn underneath one is a warning nobody sees — and "the peers are no
          longer in step" has to arrive even while a result screen is up. */}
      <NetBanner />
      <Toasts />
    </>
  );
}
