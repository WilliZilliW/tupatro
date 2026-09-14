import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { gameReducer } from "../../game/reducer";
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

  /* Four offers and the language button, and the question they answer is the
     one the menu stopped asking: are you playing alone? Continue is not among
     them any more — it is one screen down, behind Single player — and a button
     labelled from the other language would be just as clickable, so both
     catalogues are checked for it. */
  it.each([false, true])(
    "offers the two doors and nothing else with runStarted %s",
    (runStarted) => {
      const g = { ...started(), runStarted };
      const { container } = renderWith(g, <Screens />, locale);
      const labels = menuBtns(container).map((b) => b.textContent);
      expect(labels).toEqual([
        /* The contextual return is about the game already behind the menu, not
         about a door, and it is drawn for a solo run too: closing the menu
         stays one click from every game. */
        ...(runStarted ? [translate(locale, "menu.returnGame")] : []),
        translate(locale, "btn.singlePlayer"),
        translate(locale, "btn.multiplayer"),
        translate(locale, "btn.rules"),
        translate(locale, "btn.scores"),
        LOCALE_NAMES[other],
      ]);
      for (const loc of LOCALE_ORDER) {
        expect(labels).not.toContain(translate(loc, "btn.continue"));
        expect(labels).not.toContain(translate(loc, "btn.newGame"));
        expect(labels).not.toContain(translate(loc, "btn.joinGame"));
        expect(labels).not.toContain(translate(loc, "btn.challenges"));
      }
    },
  );

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

  it.each(["rummikub", "race", "tuppi"] as const)("returns to %s from the menu", (id) => {
    const solo = started();
    const g = {
      ...gameReducer(solo, { type: "startChallenge", id, seed: "CHALLENGE" }),
      menu: "start" as const,
    };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const key = id === "rummikub" ? "menu.returnChallenge" : "menu.returnMatch";
    fireEvent.click(button(container, locale, key)!);
    expect(dispatch.mock.calls).toEqual([[{ type: "closeMenu" }]]);
    expect(gameReducer(g, dispatch.mock.calls[0][0])).toEqual({ ...g, menu: null });
  });

  it("calls a shared roguelike a game rather than a match", () => {
    const g: GameState = { ...started(), seats: ["human", "human", "ai", "ai"] };
    const { container } = renderWith(g, <Screens />, locale);
    expect(button(container, locale, "menu.returnMatch")).toBeUndefined();
    expect(button(container, locale, "menu.returnGame")).toBeDefined();
  });

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

  /* A challenge entered with nothing parked has no solo run to go home to, and
     a Continue leading to a fresh run would be the new-run button wearing the
     wrong label. */
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
    expect(button(container, locale, "btn.continue")).toBeUndefined();
  });

  it("offers no Continue before a run has started, and starts one with no dialog", () => {
    const g = { ...createRun("FRESH"), menu: "single" as const };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    expect(button(container, locale, "btn.continue")).toBeUndefined();
    fireEvent.click(button(container, locale, "btn.newRun")!);
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
      fireEvent.click(button(list.container, locale, "btn.newRun")!);
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

  it.each(["race", "tuppi"] as const)(
    "starts a %s match from the lobby with no dialog",
    (match) => {
      const g = { ...started(), menu: "lobby" as const };
      const { container, dispatch, net } = renderWith(
        g,
        <Screens />,
        locale,
        0,
        stubNet({ match }),
      );
      fireEvent.click(button(container, locale, "btn.startMatch")!);
      expect(net.start).toHaveBeenCalledTimes(1);
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  /* ---------- the door's gate ---------- */

  describe.each(["host", "guest", "table"] as const)("live %s", (role) => {
    const live = () => stubNet({ role, live: true, seat: role === "table" ? null : 0 });

    /* Shut twice: `disabled` on the button and an early return in the handler.
       Both reasons are in one line — resuming a run of your own would be this
       window walking out of a session it has not left, and every mode behind
       that door builds a one-person board a guest's chair could not play. */
    it("shuts the single-player door and says why", () => {
      const { container, dispatch } = renderWith(started(), <Screens />, locale, 0, live());
      const door = button(container, locale, "btn.singlePlayer");
      /* A table draws no MoveButton at all, which is stronger than disabled. */
      if (role === "table") expect(door).toBeUndefined();
      else {
        expect(door?.disabled).toBe(true);
        fireEvent.click(door!);
      }
      expect(dispatch).not.toHaveBeenCalled();
      expect(container.textContent).toContain(translate(locale, "menu.singleLive"));
    });

    it.each(["rummikub", "race", "tuppi"] as const)(
      "leaves the return label and the lobby door alone inside %s",
      (challenge) => {
        const g = { ...started(), challenge };
        const { container, dispatch } = renderWith(g, <Screens />, locale, 0, live());
        const key = challenge === "rummikub" ? "menu.returnChallenge" : "menu.returnMatch";
        fireEvent.click(button(container, locale, key)!);
        const multi = button(container, locale, "btn.multiplayer");
        /* A table draws no MoveButton at all; everybody else gets the lobby,
           where Hang up is. */
        if (role === "table") expect(multi).toBeUndefined();
        else {
          expect(multi?.disabled).toBe(false);
          fireEvent.click(multi!);
        }
        fireEvent.click(button(container, locale, "btn.rules")!);
        fireEvent.click(button(container, locale, "btn.scores")!);
        expect(dispatch.mock.calls).toEqual([
          [{ type: "closeMenu" }],
          ...(role === "table" ? [] : [[{ type: "showMenu", view: "lobby" }]]),
          [{ type: "openModal", modal: "rules" }],
          [{ type: "openModal", modal: "scores" }],
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
});
