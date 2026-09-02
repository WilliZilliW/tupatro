import { Hand } from "./components/hand/Hand";
import { Rail } from "./components/rail/Rail";
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
      <Toasts />
    </>
  );
}
