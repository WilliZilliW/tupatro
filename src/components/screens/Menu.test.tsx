import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gameReducer } from "../../game/reducer";
import { dehydrate } from "../../game/save";
import { createRun } from "../../game/state";
import type { ChallengeId, GameState, Seat } from "../../game/types";
import { LOCALE_NAMES, LOCALE_ORDER, translate, type Locale, type LocaleKey } from "../../i18n";
import { renderWith, stubNet } from "../../test/harness";
import { App } from "../../App";
import { Screens } from "./Screens";

afterEach(cleanup);

function button(container: HTMLElement, locale: Locale, key: LocaleKey) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === translate(locale, key),
  );
}

const menuBtns = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>(".menubtns button"),
];

const started = (seat: Seat = 0): GameState => ({
  ...createRun("SOLO-MENU", 4, seat),
  runStarted: true,
  menu: "start",
});

describe.each(LOCALE_ORDER)("the start menu's two doors (%s)", (locale) => {
  const other = locale === "fi" ? "en" : "fi";

  /* Two offers and the language button, and the question they answer is the
     one the menu stopped asking: are you playing alone? Continue is not among
     them any more — it is one screen down, behind Single player — and neither
     is SCORES, which went down with the run it records, nor the contextual
     return, which moved into the lobby's own footers. A button labelled from
     the other language would be just as clickable, so both catalogues are
     checked for both. */
  it.each([false, true])(
    "offers the two doors and nothing else with runStarted %s",
    (runStarted) => {
      const g = { ...started(), runStarted };
      const { container } = renderWith(g, <Screens />, locale);
      const labels = menuBtns(container).map((b) => b.textContent);
      expect(labels).toEqual([
        translate(locale, "btn.singlePlayer"),
        translate(locale, "btn.multiplayer"),
        translate(locale, "btn.rules"),
        LOCALE_NAMES[other],
      ]);
      for (const loc of LOCALE_ORDER) {
        expect(labels).not.toContain(translate(loc, "btn.continue"));
        expect(labels).not.toContain(translate(loc, "btn.scores"));
        expect(labels).not.toContain(translate(loc, "btn.newGame"));
        expect(labels).not.toContain(translate(loc, "btn.joinGame"));
        expect(labels).not.toContain(translate(loc, "btn.challenges"));
        expect(labels).not.toContain(translate(loc, "lobby.returnChallenge"));
        expect(labels).not.toContain(translate(loc, "lobby.returnMatch"));
        expect(labels).not.toContain(translate(loc, "lobby.returnGame"));
      }
    },
  );

  /* The board is the solo roguelike's own — ScoresModal draws readScores()
     and nothing else — so it belongs behind the single-player door with the
     run that fills it, not on a menu that also opens the lobby. Asserted from
     both ends, and in both catalogues. */
  it("draws SCORES on the single-player screen and not on the menu", () => {
    const menu = renderWith(started(), <Screens />, locale);
    for (const loc of LOCALE_ORDER)
      expect(
        [...menu.container.querySelectorAll<HTMLElement>("button")].map((b) => b.textContent),
      ).not.toContain(translate(loc, "btn.scores"));
    menu.unmount();

    const { container, dispatch } = renderWith(
      { ...started(), menu: "single" as const },
      <Screens />,
      locale,
    );
    const scores = button(container, locale, "btn.scores")!;
    expect(scores).toBeDefined();
    /* Not among the things that start a game: it sits in the footer with
       Back, under the rule that separates them from the rule sets. */
    expect(scores.closest(".singlefoot")).not.toBeNull();
    expect(container.querySelector(".singlerun")?.contains(scores)).toBe(false);
    fireEvent.click(scores);
    expect(dispatch.mock.calls).toEqual([[{ type: "openModal", modal: "scores" }]]);
  });

  it("opens single player and the lobby, and dispatches nothing else", () => {
    const g = started();
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    for (const [key, view] of [
      ["btn.singlePlayer", "single"],
      ["btn.multiplayer", "lobby"],
    ] as const) {
      const btn = button(container, locale, key)!;
      expect(btn.disabled).toBe(false);
      fireEvent.click(btn);
      expect(dispatch).toHaveBeenCalledWith({ type: "showMenu", view });
      expect(gameReducer(g, { type: "showMenu", view }).menu).toBe(view);
    }
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  /* Offline the two Continues on the single-player screen are the whole
     route back — the menu itself dispatches closeMenu nowhere, whether there
     is a solo run behind it or a challenge. Clicking every enabled button on
     the menu is the check: none of them is the return that used to be
     here. */
  it.each([null, "rummikub", "race", "tuppi"] as const)(
    "dispatches closeMenu from the single-player screen and never from the menu, behind %s",
    (id) => {
      const solo = started();
      const g = {
        ...(id ? gameReducer(solo, { type: "startChallenge", id, seed: "OFFLINE" }) : solo),
        menu: "start" as const,
      };
      const menu = renderWith(g, <Screens />, locale);
      for (const btn of [...menu.container.querySelectorAll<HTMLButtonElement>("button")])
        if (!btn.disabled) fireEvent.click(btn);
      expect(menu.dispatch.mock.calls.map(([a]) => a.type)).not.toContain("closeMenu");
      menu.unmount();

      const single = renderWith({ ...g, menu: "single" as const }, <Screens />, locale);
      const singlerun = single.container.querySelector(".singlerun") as HTMLElement;
      const continueBtn = button(singlerun, locale, "btn.continue")!;
      expect(continueBtn).toBeDefined();
      fireEvent.click(continueBtn);
      expect(single.dispatch.mock.calls.map(([a]) => a.type)).toContain("closeMenu");
    },
  );

  /* ---------- the single-player screen ---------- */

  const single = (over: Partial<GameState> = {}): GameState => ({
    ...started(),
    menu: "single",
    ...over,
  });

  it.each([0, 1, 2, 3] as const)("continues the exact solo run at seat %s", (seat) => {
    const g: GameState = { ...createRun("SOLO-MENU", 4, seat), runStarted: true, menu: "single" };
    const { container, dispatch } = renderWith(g, <Screens />, locale, seat);
    fireEvent.click(button(container, locale, "btn.continue")!);
    expect(dispatch.mock.calls).toEqual([[{ type: "closeMenu" }]]);
    expect(gameReducer(g, dispatch.mock.calls[0][0])).toEqual({ ...g, menu: null });
  });

  /* Behind a challenge the solo run is `parked`, so Continue leaves the
     challenge first. Before it was offered the only route home was the
     challenge's own result screen. */
  it.each(["rummikub", "race", "tuppi"] as const)("reaches the run parked behind %s", (id) => {
    const solo = started();
    const g = {
      ...gameReducer(solo, { type: "startChallenge", id, seed: "CHALLENGE" }),
      menu: "single" as const,
    };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    fireEvent.click(button(container, locale, "btn.continue")!);
    expect(dispatch.mock.calls).toEqual([[{ type: "leaveChallenge" }], [{ type: "closeMenu" }]]);
    const resumed = dispatch.mock.calls.reduce((s, [a]) => gameReducer(s, a), g as GameState);
    expect(resumed.challenge).toBeNull();
    expect(resumed.menu).toBeNull();
    expect(resumed.parked).toBeNull();
    expect(resumed.seed).toBe(solo.seed);
    expect(resumed.runStarted).toBe(true);
  });

  /* The third branch: nothing parked, and this window is not the solo run
     either, but a real one is sitting on the main run's own key. */
  it("reaches the run on disk when this window is a different challenge and nothing is parked", () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    } satisfies Storage);
    const onDisk = createRun("DISKSAVED", 4);
    localStorage.setItem("tupatro-run-v1", JSON.stringify(dehydrate(onDisk)));

    const g = {
      ...gameReducer(started(), { type: "startChallenge", id: "race", seed: "LIVE" }),
      parked: null,
      menu: "single" as const,
    };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const singlerun = container.querySelector(".singlerun") as HTMLElement;
    fireEvent.click(button(singlerun, locale, "btn.continue")!);
    expect(dispatch).toHaveBeenCalledWith({
      type: "resumeGame",
      saved: JSON.parse(localStorage.getItem("tupatro-run-v1")!),
    });
    vi.unstubAllGlobals();
  });

  /* A challenge entered with nothing parked has no solo run to go home to, and
     a Continue leading to a fresh run would be the new-run button wearing the
     wrong label. Scoped to .singlerun: the race row itself now draws its own
     Continue, for the different reason that this window is playing it right
     now — a second, later spec's concern, not this one's. */
  it("offers no Continue in a challenge that parked nothing", () => {
    const g = {
      ...gameReducer(
        { ...createRun("NOPARK"), runStarted: false },
        { type: "startChallenge", id: "race", seed: "R" },
      ),
      parked: null,
      menu: "single" as const,
    };
    const { container } = renderWith(g, <Screens />, locale);
    const singlerun = container.querySelector(".singlerun") as HTMLElement;
    expect(button(singlerun, locale, "btn.continue")).toBeUndefined();
  });

  it("offers no Continue before a run has started, and starts one with no dialog", () => {
    const g = { ...createRun("FRESH"), menu: "single" as const };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    expect(button(container, locale, "btn.continue")).toBeUndefined();
    fireEvent.click(button(container, locale, "btn.newGame")!);
    expect(dispatch.mock.calls).toEqual([[{ type: "newRun" }]]);
    expect(gameReducer(g, dispatch.mock.calls[0][0]).runStarted).toBe(true);
  });

  it("offers no Continue to a two-human roguelike", () => {
    const g = single({ seats: ["human", "human", "ai", "ai"] });
    const { container } = renderWith(g, <Screens />, locale);
    expect(button(container, locale, "btn.continue")).toBeUndefined();
  });

  it("goes back to the start menu", () => {
    const { container, dispatch } = renderWith(single(), <Screens />, locale);
    fireEvent.click(button(container, locale, "btn.back")!);
    expect(dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "start" }]]);
  });

  /* The confirmation belongs to the destructive click, and the destructive
     click came back to the single-player screen with the run itself: newRun
     replaces the whole state, the parked run included. Cancelling returns to
     that screen, because g.menu is still "single" underneath. */
  it.each([null, "rummikub", "race", "tuppi"] as const)(
    "confirms replacing %s from the single-player screen, and cancellation preserves it",
    (id: ChallengeId | null) => {
      const prev = started(2);
      const menuState = {
        ...(id ? gameReducer(prev, { type: "startChallenge", id, seed: "OLD" }) : prev),
        menu: "start" as const,
      };
      const menu = renderWith(menuState, <Screens />, locale, 2);
      fireEvent.click(button(menu.container, locale, "btn.singlePlayer")!);
      expect(menu.dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "single" }]]);
      const screen = gameReducer(menuState, menu.dispatch.mock.calls[0][0]);
      menu.unmount();

      const list = renderWith(screen, <Screens />, locale, 2);
      fireEvent.click(button(list.container, locale, "btn.newGame")!);
      expect(list.dispatch.mock.calls).toEqual([[{ type: "openModal", modal: "restart" }]]);
      /* The run is not touched until the confirmation is confirmed. */
      const confirming = gameReducer(screen, list.dispatch.mock.calls[0][0]);
      list.unmount();

      const dialog = renderWith(confirming, <Screens />, locale, 2);
      fireEvent.click(button(dialog.container, locale, "btn.cancel")!);
      expect(dialog.dispatch.mock.calls).toEqual([[{ type: "closeModal" }]]);
      const cancelled = gameReducer(confirming, dialog.dispatch.mock.calls[0][0]);
      expect(cancelled).toEqual(screen);
      expect(cancelled.menu).toBe("single");
      expect(cancelled.runStarted).toBe(true);
      expect(cancelled.seed).toBe(screen.seed);
      dialog.dispatch.mockClear();

      fireEvent.click(button(dialog.container, locale, "btn.yesRestart")!);
      /* The dialog dispatches the run itself now — no session in between, and
         no seed and no seat on the action. */
      expect(dialog.dispatch.mock.calls).toEqual([[{ type: "newRun" }]]);
      expect(dialog.net.start).not.toHaveBeenCalled();
      const fresh = gameReducer(confirming, dialog.dispatch.mock.calls[0][0]);
      expect(fresh.runStarted).toBe(true);
      expect(fresh.challenge).toBeNull();
      expect(fresh.parked).toBeNull();
      expect(fresh.seats).toEqual(["human", "ai", "ai", "ai"]);
    },
  );

  /* Start belongs to a host with a session — the page before one exists
     configures the room and starts nothing — so this is a host in a room with
     every chair assigned. */
  it.each(["race", "tuppi"] as const)(
    "starts a %s match from the lobby with no dialog",
    (match) => {
      const g = { ...started(), menu: "lobby" as const };
      const { container, dispatch, net } = renderWith(
        g,
        <Screens />,
        locale,
        0,
        stubNet({ match, role: "host", live: true, seat: 0, room: "ABCD1234", canStart: true }),
      );
      fireEvent.click(button(container, locale, "btn.startAlone")!);
      expect(net.start).toHaveBeenCalledTimes(1);
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  /* ---------- the door's gate ---------- */

  describe.each(["host", "guest", "table"] as const)("live %s", (role) => {
    const live = () => stubNet({ role, live: true, seat: role === "table" ? null : 0 });

    /* A table draws no MoveButton at all, so it gets neither the door nor the
       dialog behind it — its way out stays the banner's Leave. A host and a
       guest get an ordinary door that asks rather than refuses: no
       `disabled`, and one click opens the "hangup" confirmation instead of
       the single-player screen, with net.hangUp untouched until that dialog
       is confirmed. */
    it("shuts the single-player door and says why", () => {
      const net = live();
      const { container, dispatch } = renderWith(started(), <Screens />, locale, 0, net);
      const door = button(container, locale, "btn.singlePlayer");
      if (role === "table") {
        expect(door).toBeUndefined();
        expect(container.textContent).not.toContain(translate(locale, "menu.singleLive"));
        expect(dispatch).not.toHaveBeenCalled();
        return;
      }
      expect(door?.disabled).toBe(false);
      expect(container.textContent).toContain(translate(locale, "menu.singleLive"));
      fireEvent.click(door!);
      expect(dispatch.mock.calls).toEqual([[{ type: "openModal", modal: "hangup" }]]);
      expect(net.hangUp).not.toHaveBeenCalled();
    });

    it.each(["rummikub", "race", "tuppi"] as const)(
      "leaves the lobby door alone inside %s",
      (challenge) => {
        const g = { ...started(), challenge };
        const { container, dispatch } = renderWith(g, <Screens />, locale, 0, live());
        const multi = button(container, locale, "btn.multiplayer");
        /* A table draws no MoveButton at all; everybody else gets the lobby,
           where Hang up — and the return this used to click here — are. */
        if (role === "table") expect(multi).toBeUndefined();
        else {
          expect(multi?.disabled).toBe(false);
          fireEvent.click(multi!);
        }
        fireEvent.click(button(container, locale, "btn.rules")!);
        /* SCORES is behind the shut door now, and that is accepted: the board
           is the solo roguelike's and no session writes to it. */
        expect(button(container, locale, "btn.scores")).toBeUndefined();
        expect(dispatch.mock.calls).toEqual([
          ...(role === "table" ? [] : [[{ type: "showMenu", view: "lobby" }]]),
          [{ type: "openModal", modal: "rules" }],
        ]);
        /* And nothing on the menu reaches a run, in any of the three roles. */
        expect(dispatch.mock.calls.map(([a]) => a).filter((a) => a.type === "newRun")).toEqual([]);
      },
    );

    /* Hang up is two clicks from the start menu for every role, and the door
       it is behind is Multiplayer now. The lobby's own footer is the second. */
    it("reaches a hang-up from the start menu in two clicks", () => {
      const g = started();
      const menu = renderWith(g, <Screens />, locale, 0, live());
      /* A table has no Multiplayer button, so its route is the banner's own —
         one click, not two, and the same session method at the end. The banner
         is drawn outside Screens, so that half is read through App. */
      const first = button(menu.container, locale, "btn.multiplayer");
      if (role === "table") {
        expect(first).toBeUndefined();
        menu.unmount();

        const withBanner = renderWith(g, <App />, locale, 0, live());
        fireEvent.click(button(withBanner.container, locale, "btn.hangUp")!);
        expect(withBanner.net.hangUp).toHaveBeenCalledTimes(1);
        /* And it lands on the start menu rather than on a board it is no
           longer a peer of. */
        expect(withBanner.dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "start" }]]);
        withBanner.unmount();
        return;
      }
      fireEvent.click(first!);
      expect(menu.dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "lobby" }]]);
      const lobby = gameReducer(g, menu.dispatch.mock.calls[0][0]);
      menu.unmount();

      const view = renderWith(lobby, <Screens />, locale, 0, live());
      fireEvent.click(button(view.container, locale, "btn.hangUp")!);
      expect(view.net.hangUp).toHaveBeenCalledTimes(1);
      expect(view.dispatch).not.toHaveBeenCalled();
    });
  });

  /* ---------- the hang-up confirmation itself ---------- */

  describe.each(["host", "guest"] as const)("the hang-up dialog for a live %s", (role) => {
    const dialogState = () => ({ ...started(), modal: "hangup" as const });

    /* net.hangUp() runs first, synchronously — showMenu does not clear
       g.modal on its own, so both dispatches after it are needed, and the
       order matters: this window has to have stopped being a peer before
       menu: "single" is ever set. */
    it("hangs up before it opens the door", () => {
      const net = stubNet({ role, live: true, seat: 0 });
      const order: string[] = [];
      vi.mocked(net.hangUp).mockImplementation(() => order.push("hangUp"));
      const { container, dispatch } = renderWith(dialogState(), <Screens />, locale, 0, net);
      dispatch.mockImplementation((a) => order.push(a.type));

      fireEvent.click(button(container, locale, "btn.yesHangUp")!);

      expect(order).toEqual(["hangUp", "closeModal", "showMenu"]);
      expect(dispatch.mock.calls).toEqual([
        [{ type: "closeModal" }],
        [{ type: "showMenu", view: "single" }],
      ]);
      expect(net.hangUp).toHaveBeenCalledTimes(1);
    });

    it("is free to cancel", () => {
      const net = stubNet({ role, live: true, seat: 0 });
      const g = dialogState();
      const { container, dispatch } = renderWith(g, <Screens />, locale, 0, net);

      fireEvent.click(button(container, locale, "btn.cancel")!);

      expect(dispatch.mock.calls).toEqual([[{ type: "closeModal" }]]);
      expect(gameReducer(g, dispatch.mock.calls[0][0])).toEqual(started());
      expect(net.hangUp).not.toHaveBeenCalled();
    });

    it("names the extra cost for a host alone", () => {
      const net = stubNet({ role, live: true, seat: 0 });
      const { container } = renderWith(dialogState(), <Screens />, locale, 0, net);
      expect(container.textContent).toContain(translate(locale, "hangup.body"));
      if (role === "host")
        expect(container.textContent).toContain(translate(locale, "hangup.hostBody"));
      else expect(container.textContent).not.toContain(translate(locale, "hangup.hostBody"));
    });
  });
});
