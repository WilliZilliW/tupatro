import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { gameReducer } from "../../game/reducer";
import { createRun } from "../../game/state";
import type { ChallengeId, GameState, Seat } from "../../game/types";
import { LOCALE_ORDER, translate, type Locale, type LocaleKey } from "../../i18n";
import { renderWith, stubNet } from "../../test/harness";
import { App } from "../../App";
import { Screens } from "./Screens";

afterEach(cleanup);

function button(container: HTMLElement, locale: Locale, key: LocaleKey) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === translate(locale, key),
  );
}

const started = (seat: Seat = 0): GameState => ({
  ...createRun("SOLO-MENU", 4, seat),
  runStarted: true,
  menu: "start",
});

describe.each(LOCALE_ORDER)("solo start-menu controls (%s)", (locale) => {
  it.each([0, 1, 2, 3] as const)("continues the exact solo run at seat %s", (seat) => {
    const g = started(seat);
    const { container, dispatch } = renderWith(g, <Screens />, locale, seat);
    expect(button(container, locale, "menu.returnMatch")).toBeUndefined();
    fireEvent.click(button(container, locale, "btn.continue")!);
    expect(dispatch.mock.calls).toEqual([[{ type: "closeMenu" }]]);
    expect(gameReducer(g, dispatch.mock.calls[0][0])).toEqual({ ...g, menu: null });
  });

  /* New game is the lobby door, and the lobby opens on the plan New game used
     to dispatch: me at my own chair and the game at the other three. The
     second click is Start, and it is the session that composes the action. */
  it("opens the lobby from New game and starts the pre-filled solo plan there", () => {
    const g = { ...createRun("FRESH"), menu: "start" as const };
    const menu = renderWith(g, <Screens />, locale);
    expect(button(menu.container, locale, "btn.continue")).toBeUndefined();
    fireEvent.click(button(menu.container, locale, "btn.newGame")!);
    expect(menu.dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "lobby" }]]);
    const lobby = gameReducer(g, menu.dispatch.mock.calls[0][0]);
    expect(lobby.menu).toBe("lobby");
    expect(lobby.runStarted).toBe(false);
    menu.unmount();

    const table = renderWith(lobby, <Screens />, locale);
    expect(
      table.container.querySelector('.modepicks button[data-mode="run"]')?.className,
    ).toContain("on");
    fireEvent.click(button(table.container, locale, "btn.startMatch")!);
    expect(table.net.start).toHaveBeenCalledTimes(1);
    /* No confirmation and no dispatch of its own: there is no run to lose. */
    expect(table.dispatch).not.toHaveBeenCalled();
  });

  it("joins somebody else's game from the menu, without a door in between", () => {
    const g = { ...createRun("FRESH"), menu: "start" as const };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    fireEvent.click(button(container, locale, "btn.joinGame")!);
    expect(dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "join" }]]);
    expect(gameReducer(g, dispatch.mock.calls[0][0]).menu).toBe("join");
  });

  /* Two offers inside a challenge, and they go opposite ways: the labelled
     return lowers the menu back onto the challenge, Continue leaves it for the
     parked solo run. Before Continue was drawn here the only route home was
     the challenge's own result screen, so a player who opened the menu
     mid-challenge was offered nothing but New game. */
  it.each(["rummikub", "race", "tuppi"] as const)(
    "returns to %s and still reaches the parked solo run",
    (id) => {
      const solo = started();
      const g = {
        ...gameReducer(solo, { type: "startChallenge", id, seed: "CHALLENGE" }),
        menu: "start" as const,
      };
      const back = renderWith(g, <Screens />, locale);
      const key = id === "rummikub" ? "menu.returnChallenge" : "menu.returnMatch";
      fireEvent.click(button(back.container, locale, key)!);
      expect(back.dispatch.mock.calls).toEqual([[{ type: "closeMenu" }]]);
      expect(gameReducer(g, back.dispatch.mock.calls[0][0])).toEqual({ ...g, menu: null });
      back.unmount();

      const home = renderWith(g, <Screens />, locale);
      fireEvent.click(button(home.container, locale, "btn.continue")!);
      expect(home.dispatch.mock.calls).toEqual([
        [{ type: "leaveChallenge" }],
        [{ type: "closeMenu" }],
      ]);
      const resumed = home.dispatch.mock.calls.reduce(
        (s, [a]) => gameReducer(s, a),
        g as GameState,
      );
      expect(resumed.challenge).toBeNull();
      expect(resumed.menu).toBeNull();
      expect(resumed.parked).toBeNull();
      expect(resumed.seed).toBe(solo.seed);
      expect(resumed.runStarted).toBe(true);
    },
  );

  /* The confirmation moved to the destructive click: the lobby's Start for the
     roguelike, which is the one mode whose action destroys the run behind the
     menu. New game raises no modal from any of these states, and cancelling
     returns to the lobby it was raised from. */
  it.each([null, "rummikub", "race", "tuppi"] as const)(
    "confirms replacing %s from the lobby, and cancellation preserves it",
    (id: ChallengeId | null) => {
      const prev = started(2);
      const g = {
        ...(id ? gameReducer(prev, { type: "startChallenge", id, seed: "OLD" }) : prev),
        menu: "start" as const,
      };
      const menu = renderWith(g, <Screens />, locale, 2);
      fireEvent.click(button(menu.container, locale, "btn.newGame")!);
      expect(menu.dispatch.mock.calls).toEqual([[{ type: "showMenu", view: "lobby" }]]);
      const lobby = gameReducer(g, menu.dispatch.mock.calls[0][0]);
      menu.unmount();

      const table = renderWith(lobby, <Screens />, locale, 2);
      fireEvent.click(button(table.container, locale, "btn.startMatch")!);
      expect(table.dispatch.mock.calls).toEqual([[{ type: "openModal", modal: "restart" }]]);
      /* The run is not touched until the confirmation is confirmed. */
      expect(table.net.start).not.toHaveBeenCalled();
      const confirming = gameReducer(lobby, table.dispatch.mock.calls[0][0]);
      table.unmount();

      const dialog = renderWith(confirming, <Screens />, locale, 2);
      fireEvent.click(button(dialog.container, locale, "btn.cancel")!);
      expect(dialog.dispatch.mock.calls).toEqual([[{ type: "closeModal" }]]);
      expect(gameReducer(confirming, dialog.dispatch.mock.calls[0][0])).toEqual(lobby);
      dialog.dispatch.mockClear();
      fireEvent.click(button(dialog.container, locale, "btn.yesRestart")!);
      /* Through the session, which is what carries the lobby's chairs and its
         mode into the action. */
      expect(dialog.net.start).toHaveBeenCalledTimes(1);
      expect(dialog.dispatch).not.toHaveBeenCalled();
    },
  );

  /* And the two match modes raise no confirmation at all, because
     startChallenge parks the run where newRun destroys it. */
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

  it("calls a shared roguelike a game rather than a match", () => {
    const g: GameState = { ...started(), seats: ["human", "human", "ai", "ai"] };
    const { container } = renderWith(g, <Screens />, locale);
    expect(button(container, locale, "btn.continue")).toBeUndefined();
    expect(button(container, locale, "menu.returnMatch")).toBeUndefined();
    expect(button(container, locale, "menu.returnGame")).toBeDefined();
  });

  /* A challenge entered with nothing parked has no solo run to go home to,
     and a Continue leading to a fresh seat-0 run would be New game wearing
     the wrong label. */
  it("offers no Continue in a challenge that parked nothing", () => {
    const g = {
      ...gameReducer(
        { ...createRun("NOPARK"), runStarted: false },
        {
          type: "startChallenge",
          id: "race",
          seed: "R",
        },
      ),
      parked: null,
      menu: "start" as const,
    };
    const { container } = renderWith(g, <Screens />, locale);
    expect(button(container, locale, "btn.continue")).toBeUndefined();
    expect(button(container, locale, "menu.returnMatch")).toBeDefined();
  });

  /* An open room has started nothing, so the run behind the menu is still the
     solo roguelike: no return label may promise a match, and the run may not be
     resumed until the window has left the session. */
  it.each(["host", "guest", "table"] as const)(
    "disables solo Continue for a %s whose room has started no match",
    (role) => {
      const g = started();
      const net = stubNet({ role, live: true, seat: role === "table" ? null : 0 });
      const { container, dispatch } = renderWith(g, <Screens />, locale, 0, net);
      for (const key of ["menu.returnMatch", "menu.returnChallenge", "menu.returnGame"] as const)
        expect(button(container, locale, key)).toBeUndefined();
      const cont = button(container, locale, "btn.continue");
      /* A table draws no MoveButton at all, which is stronger than disabled. */
      if (role === "table") expect(cont).toBeUndefined();
      else {
        expect(cont?.disabled).toBe(true);
        fireEvent.click(cont!);
      }
      expect(dispatch).not.toHaveBeenCalled();
      expect(container.textContent).toContain(translate(locale, "menu.soloOnly"));
    },
  );

  it("resumes the solo run once the session is over", () => {
    const g = started();
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    const cont = button(container, locale, "btn.continue");
    expect(cont?.disabled).toBe(false);
    fireEvent.click(cont!);
    expect(dispatch.mock.calls).toEqual([[{ type: "closeMenu" }]]);
    expect(gameReducer(g, dispatch.mock.calls[0][0])).toEqual({ ...g, menu: null });
  });

  describe.each(["host", "guest", "table"] as const)("live %s", (role) => {
    const live = () => stubNet({ role, live: true, seat: role === "table" ? null : 0 });

    it.each(["rummikub", "race", "tuppi"] as const)(
      "never offers solo Continue inside %s, and leaves New game as the lobby door",
      (challenge) => {
        const g = { ...started(), challenge };
        const { container, dispatch } = renderWith(g, <Screens />, locale, 0, live());
        expect(button(container, locale, "btn.continue")).toBeUndefined();

        const key = challenge === "rummikub" ? "menu.returnChallenge" : "menu.returnMatch";
        fireEvent.click(button(container, locale, key)!);
        const newGame = button(container, locale, "btn.newGame");
        /* A table draws no MoveButton at all, which is stronger than disabled;
           everybody else gets the lobby, where Hang up is. */
        if (role === "table") {
          expect(newGame).toBeUndefined();
          expect(button(container, locale, "btn.joinGame")).toBeUndefined();
        } else {
          expect(newGame?.disabled).toBe(false);
          fireEvent.click(newGame!);
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

    /* Hang up survived the door it lived behind: from the start menu it is two
       clicks away for every role. The lobby's own footer is the second. */
    it("reaches a hang-up from the start menu in two clicks", () => {
      const g = started();
      const menu = renderWith(g, <Screens />, locale, 0, live());
      /* A table has no New game, so its route is the banner's own button —
         one click, not two, and the same session method at the end. The banner
         is drawn outside Screens, so that half is read through App. */
      const first = button(menu.container, locale, "btn.newGame");
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

    it("confirms a restart through the session, and cancels back to the lobby", () => {
      const g = { ...started(), menu: "lobby" as const, modal: "restart" as const };
      const { container, dispatch, net } = renderWith(g, <Screens />, locale, 0, live());
      const confirm = button(container, locale, "btn.yesRestart");
      if (role === "table") expect(confirm).toBeUndefined();
      else {
        fireEvent.click(confirm!);
        expect(net.start).toHaveBeenCalledTimes(1);
      }
      expect(dispatch).not.toHaveBeenCalled();
      fireEvent.click(button(container, locale, "btn.cancel")!);
      expect(dispatch.mock.calls).toEqual([[{ type: "closeModal" }]]);
      expect(gameReducer(g, { type: "closeModal" }).menu).toBe("lobby");
    });
  });
});
