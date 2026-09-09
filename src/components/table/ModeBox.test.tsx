import { describe, expect, it } from "vitest";
import { ModeBox } from "./ModeBox";
import { loadedState, renderWith, stubNet } from "../../test/harness";
import { seatNameIn, translate } from "../../i18n";
import type { Seat } from "../../game/types";

describe("ModeBox's soloist labels", () => {
  it.each(
    ([null, "race", "tuppi"] as const).flatMap((challenge) =>
      (["en", "fi"] as const).flatMap((locale) =>
        (["human", "ai"] as const).flatMap((kind) =>
          (["soolioffer", "sooligive", "sooliready", "play"] as const).map((phase) => ({
            challenge,
            locale,
            kind,
            phase,
          })),
        ),
      ),
    ),
  )(
    "names $challenge's $kind soloist in $phase ($locale) from every window",
    ({ challenge, locale, kind, phase }) => {
      for (const soloist of [0, 1, 2, 3] as const) {
        const seats = ["human", "human", "human", "human"] as const;
        const state = loadedState({
          challenge,
          phase,
          sooli: phase !== "soolioffer",
          sooliSeat: soloist,
          seats: [...seats],
        });
        state.seats[soloist] = kind;
        for (const viewer of [0, 1, 2, 3, null] as const) {
          const { container, unmount } = renderWith(
            state,
            <ModeBox />,
            locale,
            (viewer ?? 0) as Seat,
            stubNet({ role: viewer === null ? "table" : "guest", live: true, seat: viewer }),
          );
          const note = container.querySelector(".note")?.textContent;
          const secondPerson = translate(locale, "table.sooliNote");
          if (phase === "soolioffer") {
            expect(container.querySelector(".val")?.textContent).toBe("RAMI");
            expect(note).not.toBe(secondPerson);
          } else {
            expect(container.querySelector(".val")?.textContent).toBe("SOOLI");
            if (viewer === soloist) expect(note).toBe(secondPerson);
            else {
              expect(note).toBe(
                translate(locale, "table.sooliNoteTable", {
                  who: seatNameIn(locale, soloist, null),
                }),
              );
              expect(note).not.toContain(secondPerson);
            }
          }
          unmount();
        }
      }
    },
  );
});
