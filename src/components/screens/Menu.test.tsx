import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { gameReducer } from "../../game/reducer";
import { createRun } from "../../game/state";
import type { ChallengeId, GameState, Seat } from "../../game/types";
import { LOCALE_ORDER, translate, type Locale, type LocaleKey } from "../../i18n";
import { renderWith, stubNet } from "../../test/harness";
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

  it("starts a fresh solo run without offering Continue or asking for chairs", () => {
    const g = { ...createRun("FRESH"), menu: "start" as const };
    const { container, dispatch } = renderWith(g, <Screens />, locale);
    expect(button(container, locale, "btn.continue")).toBeUndefined();
    fireEvent.click(button(container, locale, "btn.newGame")!);
    expect(dispatch.mock.calls).toEqual([[{ type: "newRun" }]]);
    const next = gameReducer(g, dispatch.mock.calls[0][0]);
    expect(next.challenge).toBeNull();
    expect(next.seats).toEqual(["human", "ai", "ai", "ai"]);
    expect(next.runStarted).toBe(true);
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

  it.each([null, "rummikub", "race", "tuppi"] as const)(
    "confirms replacement of %s with a seat-0 solo run; cancellation preserves it",
    (id: ChallengeId | null) => {
      const prev = started(2);
      const g = {
        ...(id ? gameReducer(prev, { type: "startChallenge", id, seed: "OLD" }) : prev),
        menu: "start" as const,
      };
      const menu = renderWith(g, <Screens />, locale, 2);
      fireEvent.click(button(menu.container, locale, "btn.newGame")!);
      expect(menu.dispatch.mock.calls).toEqual([[{ type: "openModal", modal: "restart" }]]);
      const confirming = gameReducer(g, menu.dispatch.mock.calls[0][0]);
      menu.unmount();

      const dialog = renderWith(confirming, <Screens />, locale, 2);
      fireEvent.click(button(dialog.container, locale, "btn.cancel")!);
      expect(gameReducer(confirming, dialog.dispatch.mock.calls[0][0])).toEqual(g);
      dialog.dispatch.mockClear();
      fireEvent.click(button(dialog.container, locale, "btn.yesRestart")!);
      expect(dialog.dispatch.mock.calls).toEqual([[{ type: "newRun" }]]);
      const next = gameReducer(confirming, dialog.dispatch.mock.calls[0][0]);
      expect(next.challenge).toBeNull();
      expect(next.parked).toBeNull();
      expect(next.seats).toEqual(["human", "ai", "ai", "ai"]);
      expect(next.menu).toBeNull();
      expect(next.screen).toEqual({ kind: "blindselect" });
      expect(next.runStarted).toBe(true);
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
      "never offers solo Continue or starts a shared new run from %s",
      (challenge) => {
        const g = { ...started(), challenge };
        const { container, dispatch } = renderWith(g, <Screens />, locale, 0, live());
        expect(button(container, locale, "btn.continue")).toBeUndefined();
        const newGame = button(container, locale, "btn.newGame");
        if (role === "table") expect(newGame).toBeUndefined();
        else {
          expect(newGame?.disabled).toBe(true);
          fireEvent.click(newGame!);
        }
        expect(dispatch).not.toHaveBeenCalled();
        expect(container.textContent).toContain(translate(locale, "menu.soloOnly"));

        const key = challenge === "rummikub" ? "menu.returnChallenge" : "menu.returnMatch";
        fireEvent.click(button(container, locale, key)!);
        fireEvent.click(button(container, locale, "btn.multiplayer")!);
        fireEvent.click(button(container, locale, "btn.rules")!);
        fireEvent.click(button(container, locale, "btn.scores")!);
        expect(dispatch.mock.calls).toEqual([
          [{ type: "closeMenu" }],
          [{ type: "showMenu", view: "multi" }],
          [{ type: "openModal", modal: "rules" }],
          [{ type: "openModal", modal: "scores" }],
        ]);
      },
    );

    it("cannot confirm a restart even if the dialog is already open", () => {
      const g = { ...started(), modal: "restart" as const };
      const { container, dispatch } = renderWith(g, <Screens />, locale, 0, live());
      const confirm = button(container, locale, "btn.yesRestart");
      if (role === "table") expect(confirm).toBeUndefined();
      else {
        expect(confirm?.disabled).toBe(true);
        fireEvent.click(confirm!);
      }
      expect(dispatch).not.toHaveBeenCalled();
      fireEvent.click(button(container, locale, "btn.cancel")!);
      expect(dispatch.mock.calls).toEqual([[{ type: "closeModal" }]]);
    });
  });
});
