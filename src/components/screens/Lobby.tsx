import { useState } from "react";
import { SEATS, partnerOf } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { readRaceScores } from "../../game/storage";
import { useDispatch } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { codeInHash } from "../../net/signal";
import { cx } from "../cx";
import { Overlay } from "../Overlay";
import { QrCode } from "../net/QrCode";
import type { ChairKind, NetChair, SdpProblem } from "../../hooks/netContext";
import type { LocaleKey } from "../../i18n";

/* The lobby, which is what starts the Tuppikilpa race — hosted across
   browsers, or against nobody but the game.

   The four chairs are the whole of who plays: each of them is this window's
   own player, a person sitting at this same screen, an open chair a peer
   connects to, or the game. Start turns them into `seats` and dispatches
   `startChallenge`, which offline goes straight to the reducer and in a
   session is numbered and broadcast like any other flow action.

   Who sits where is not a rule of tuppi — the club's sheet and korttipeliopas
   both state every positional rule relative to the dealer or the elder hand,
   and neither names a seat for anybody — so the host may take any chair and
   hand out the rest. What the seat changes is which hand a given seed deals
   and where the rotating deal puts you.

   The rows are the seats in engine order, not the deal order: the dealer
   rotates on every startBlind and nextDeal, so "you declare first here" would
   be false after one deal.

   Everything the exchange needs is component-local useState or the net
   context. None of it is on GameState and none of it is in the save: the run
   this configures does not exist until Start is clicked, and a session is a
   property of the window.

   Like the end screens and the challenges list, this reads a board while it
   renders — the race's best result is not part of GameState — and it reads it
   through game/storage.ts, which is the one door. */

const WHY: Record<SdpProblem, LocaleKey> = {
  empty: "net.bad.empty",
  format: "net.bad.format",
  version: "net.bad.version",
  kind: "net.bad.kind",
  decode: "net.bad.decode",
};

const KIND_LABEL: Record<ChairKind, LocaleKey> = {
  me: "lobby.kindMe",
  hot: "lobby.kindHot",
  open: "lobby.kindOpen",
  ai: "lobby.kindAi",
};

const CHAIR_STATE: Record<NetChair["state"], LocaleKey> = {
  idle: "lobby.chairIdle",
  inviting: "lobby.chairInviting",
  waiting: "lobby.chairWaiting",
  connected: "lobby.chairConnected",
  failed: "lobby.chairFailed",
};

function Copy({ text }: { text: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn small"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
      }}
    >
      {t(done ? "btn.copied" : "btn.copy")}
    </button>
  );
}

/* The invitation, three ways to move it: read it, copy it, or point a camera
   at it. The QR carries the page's own address with the code in the fragment,
   so a phone's camera app opens the game with the box already filled. */
function CodeBlock({ code, label }: { code: string; label: string }) {
  const { t } = useI18n();
  return (
    <div className="codeblock">
      <textarea className="codebox" readOnly value={code} rows={3} aria-label={label} />
      <QrCode text={joinUrl(code)} label={t("lobby.qrAlt")} />
      <div className="row">
        <Copy text={code} />
      </div>
    </div>
  );
}

const joinUrl = (code: string): string =>
  `${window.location.origin}${window.location.pathname}#j=${code}`;

export function Lobby({ joining = false }: { joining?: boolean } = {}) {
  const dispatch = useDispatch();
  const net = useNet();
  const { t, seatName } = useI18n();
  const fromLink = codeInHash(window.location.hash);
  const [view, setView] = useState<"pick" | "join">(joining || fromLink ? "join" : "pick");
  const [hostCode, setHostCode] = useState(fromLink ?? "");
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const mine = (net.chairs.find((c) => c.kind === "me") ?? net.chairs[0]).seat;
  const open = net.chairs.filter((c) => c.kind === "open");
  const ready = open.length > 0 && open.every((c) => c.state === "connected");
  /* Back goes to the door the lobby was opened from, not to the start menu:
     Hang up lives there now, so a host who has not connected everybody has to
     be able to get to it. */
  const back = () => dispatch({ type: "showMenu", view: "multi" });

  /* ==================== the host's table ==================== */
  if (net.role === "host")
    return (
      <Overlay>
        <h2>{t("lobby.hostTitle")}</h2>
        {/* The character's name, not seatName's "You": "sitting in You\'s chair"
            says nothing, and which chair the host took is the one fact this
            line carries. */}
        <p className="dek">{t("lobby.hostDek", { who: SEATS[mine].name })}</p>
        {open.length === 0 && <p className="dek">{t("lobby.noChairs")}</p>}
        {open.map((c) => (
          <div key={c.seat} className={cx("netchair", c.state === "connected" && "on")}>
            <h3>
              {SEATS[c.seat].short} {seatName(c.seat, mine)} — {t(CHAIR_STATE[c.state])}
            </h3>
            {c.state !== "connected" && c.code && (
              <>
                <p className="dek">
                  {c.complete
                    ? t("lobby.inviteReady")
                    : t("lobby.inviteGathering", { n: c.candidates })}
                </p>
                <CodeBlock code={c.code} label={t("lobby.invite")} />
                <label className="netlabel" htmlFor={`ans${c.seat}`}>
                  {t("lobby.answerBox")}
                </label>
                <textarea
                  id={`ans${c.seat}`}
                  className="codebox"
                  rows={3}
                  value={answers[c.seat] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [c.seat]: e.target.value }))}
                />
                <div className="row">
                  <button
                    className="btn small"
                    onClick={() => net.connect(c.seat, answers[c.seat] ?? "")}
                  >
                    {t("btn.connect")}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {net.problem && <p className="warn">{t(WHY[net.problem])}</p>}
        <p className="dek">{ready ? t("lobby.allHere") : t("lobby.needAll")}</p>
        <div className="row lobbyfoot flow">
          <button className="btn" disabled={!ready} onClick={() => net.start()}>
            {t("btn.startMatch")}
          </button>
          <button className="btn ghost" onClick={back}>
            {t("btn.back")}
          </button>
        </div>
      </Overlay>
    );

  /* ==================== a guest, waiting ==================== */
  if (net.role === "guest")
    return (
      <Overlay>
        <h2>{t("lobby.joinTitle")}</h2>
        <p className="dek">{t("lobby.answerHint")}</p>
        {net.answer && <CodeBlock code={net.answer} label={t("lobby.yourAnswer")} />}
        <p className="dek">
          {net.seat === null
            ? t("lobby.waitingHost")
            : t("lobby.seated", { who: SEATS[net.seat].name })}
        </p>
        <div className="row lobbyfoot flow">
          <button className="btn ghost" onClick={back}>
            {t("btn.back")}
          </button>
        </div>
      </Overlay>
    );

  /* ==================== joining ==================== */
  if (view === "join")
    return (
      <Overlay>
        <h2>{t("lobby.joinTitle")}</h2>
        <p className="dek">{t("lobby.joinDek")}</p>
        <label className="netlabel" htmlFor="hostcode">
          {t("lobby.pasteHost")}
        </label>
        <textarea
          id="hostcode"
          className="codebox"
          rows={4}
          value={hostCode}
          onChange={(e) => setHostCode(e.target.value)}
        />
        <LanSwitch />
        {net.problem && <p className="warn">{t(WHY[net.problem])}</p>}
        <div className="row lobbyfoot">
          <button className="btn" onClick={() => net.join(hostCode)}>
            {t("btn.join")}
          </button>
          <button className="btn ghost" onClick={() => setView("pick")}>
            {t("btn.back")}
          </button>
        </div>
      </Overlay>
    );

  /* ==================== the table, before anyone is invited ============== */
  return (
    <Overlay>
      <h2>{t("lobby.title")}</h2>
      <p className="dek">{t("lobby.dek")}</p>
      <div className="seatpicks">
        {net.chairs.map((c) => (
          <div
            key={c.seat}
            className={cx("seatpick", c.kind === "me" && "selected")}
            data-seat={c.seat}
          >
            <span className="av">{SEATS[c.seat].short}</span>
            <span className="who">{seatName(c.seat, mine)}</span>
            <span className="kinds">
              {(["me", "hot", "open", "ai"] as ChairKind[]).map((k) => (
                <button
                  key={k}
                  className={cx("kind", c.kind === k && "on")}
                  data-kind={k}
                  onClick={() => net.setChair(c.seat, k)}
                >
                  {t(KIND_LABEL[k])}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="dek">{t("lobby.partner", { who: seatName(partnerOf(mine), mine) })}</p>
      <RaceLine />
      <LanSwitch />
      <p className="dek">{t("lobby.readable")}</p>
      <p className="dek">{t("lobby.startNote")}</p>
      <div className="row lobbyfoot">
        {/* Always enabled: a "me" chair always exists, so there is always
            somebody to play, and an open chair nobody answered is played by
            the game rather than blocking the button with a reason the player
            cannot see. */}
        <button className="btn" onClick={() => net.start()}>
          {t("btn.startMatch")}
        </button>
        <button className="btn ghost" onClick={() => net.invite(mine)}>
          {t("btn.hostGame")}
        </button>
        <button className="btn ghost" onClick={() => setView("join")}>
          {t("btn.joinGame")}
        </button>
        <button className="btn ghost" onClick={back}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}

/* The mode the lobby starts, named where it is started: the name and the
   description come from the race's own CHALLENGES row, so one catalogue entry
   names it everywhere it is offered. The best line is the one the challenges
   list used to carry — a board whose best row is a loss reads as no result
   yet, because the line is about a match won. */
function RaceLine() {
  const { t, fmt, nameOf, descOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === "race") ?? CHALLENGES[0];
  const best = readRaceScores()[0];
  return (
    <div className="lobbymode">
      <h3>{nameOf(row)}</h3>
      <p className="dek">{descOf(row)}</p>
      <p className="dek">
        {best?.won ? t("race.bestWon", { deals: fmt(best.deals) }) : t("challenges.noBest")}
      </p>
    </div>
  );
}

/* STUN is a third party: with it the invitation carries the player's public
   address, and without it the two browsers can only meet on one network. That
   is a choice a player is entitled to make, so it is a switch and not a
   constant. */
function LanSwitch() {
  const net = useNet();
  const { t } = useI18n();
  return (
    <label className="lanswitch">
      <input type="checkbox" checked={net.lan} onChange={(e) => net.setLan(e.target.checked)} />
      <span>{t("lobby.lan")}</span>
      <span className="dek">{net.lan ? t("lobby.lanOn") : t("lobby.lanOff")}</span>
    </label>
  );
}
