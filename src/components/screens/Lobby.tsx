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
import type { ChairKind, ChairState, NetChair, SdpProblem } from "../../hooks/netContext";
import type { MatchId, Seat } from "../../game/types";
import type { LocaleKey } from "../../i18n";
import type { GuestRole } from "../../net/protocol";

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
   renders — a mode's best result is not part of GameState — and it reads it
   through game/storage.ts, which is the one door. */

const WHY: Record<SdpProblem, LocaleKey> = {
  empty: "net.bad.empty",
  format: "net.bad.format",
  version: "net.bad.version",
  kind: "net.bad.kind",
  decode: "net.bad.decode",
  refused: "net.bad.refused",
};

/* An invitation that has been answered, whichever thing answered it. Both are
   the end of the exchange: the device is here, and a chair claimed by the
   shared display is as settled as one a player took — the game plays it.
   Drawing the code, the QR, the answer box and a live Connect after that is a
   control that lies, and clicking it hands a second answer to a connection
   that is already stable, which the browser rejects. */
const settled = (s: ChairState): boolean => s === "connected" || s === "table";

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
  table: "lobby.chairTable",
};

/* Which of the two things a joining device is. The suggestion is a plain width
   read on the first render — not a media query and not a device class — with
   900 putting a landscape phone (844) under it and a tablet or a laptop over
   it. It is a suggestion the player can override in either direction, and
   nothing in the game reads it again. */
const TABLE_WIDTH = 900;

const AS_LABEL: Record<GuestRole, LocaleKey> = {
  player: "lobby.asPlayer",
  table: "lobby.asTable",
};

const AS_DEK: Record<GuestRole, LocaleKey> = {
  player: "lobby.asPlayerDek",
  table: "lobby.asTableDek",
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

/* One side's code in the swap, three ways to move it: read it, copy it, or
   point a camera at it. The QR carries the page's own address with the code in
   the fragment, so a phone's camera app opens the game with the box already
   filled. */
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

/* The room's code, which is the whole invitation on that route: eight
   characters, read out loud. No QR and no answer to carry back — the point of
   a room is that nothing has to be moved between the players but this. */
function RoomCode({ code }: { code: string }) {
  const { t } = useI18n();
  return (
    <div className="roomcode">
      <span className="netlabel">{t("lobby.roomCode")}</span>
      <strong className="roomchars">{code}</strong>
      <Copy text={code} />
    </div>
  );
}

export function Lobby({ joining = false }: { joining?: boolean } = {}) {
  const dispatch = useDispatch();
  const net = useNet();
  const { t, seatName } = useI18n();
  const fromLink = codeInHash(window.location.hash);
  /* A #j= link wins over the door it was opened behind: it carries a code that
     only the code swap can use, so it lands on that page whichever menu view
     raised the lobby. Without one the door decides — Host goes to the chair
     table, Join to the room's code box. */
  const [view, setView] = useState<"pick" | "join" | "more">(
    fromLink !== null ? "more" : joining ? "join" : "pick",
  );
  /* Which side of the swap this window is on, and so which page Other ways to
     connect shows. The link decides that for the page it landed on and for
     nothing after it: the hash is never cleared — it survives a reload — so a
     window opened from somebody's QR that kept reading it would sit on the
     joining side for ever, and a host would never reach the chair table again
     (Other ways -> Back is the room's code box, whose Back leaves the lobby,
     with "pick" unreachable). Leaving that page hands the side back to the
     door the lobby was opened by. */
  const [linked, setLinked] = useState(fromLink !== null);
  const guestSide = joining || linked;
  const [hostCode, setHostCode] = useState(fromLink ?? "");
  const [roomCode, setRoomCode] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [tableAnswer, setTableAnswer] = useState("");
  const [joinAs, setJoinAs] = useState<GuestRole>(() =>
    window.innerWidth >= TABLE_WIDTH ? "table" : "player",
  );

  const mine = (net.chairs.find((c) => c.kind === "me") ?? net.chairs[0]).seat;
  const open = net.chairs.filter((c) => c.kind === "open");
  /* A chair answered by the shared table is settled too: the device is here,
     it holds no chair, and the game plays that one. Waiting for it to become
     "connected" would leave Start disabled for ever.

     The table's own invitation does gate the match, and that is not cosmetic:
     connected before Start is the display's one precondition, and there is no
     reconnect. A Start clicked while it is still answering numbers the first
     action, after which the host refuses the display with `late` — the feature
     lost by pressing a button that said it was ready. A failed link is settled
     too, since it will never connect; a host who changes their mind hangs up
     and invites again with the switch off. */
  const tableSettled =
    net.tableInvite === null ||
    net.tableInvite.state === "connected" ||
    net.tableInvite.state === "failed";
  const ready =
    (open.length > 0 || net.tableInvite !== null) &&
    open.every((c) => settled(c.state)) &&
    tableSettled;
  /* Back goes to the door the lobby was opened from, not to the start menu:
     Hang up lives there now, so a host who has not connected everybody has to
     be able to get to it. */
  const back = () => dispatch({ type: "showMenu", view: "multi" });
  /* Neither route has a timeout — useGameLoop is the only timer — so a blocked
     relay and a host who has not started yet look exactly alike: silence. The
     escape is therefore offered for the whole wait rather than after a failure
     nobody can detect, and it hangs up on the way out, because a room session
     is live from the moment it is opened or entered. */
  const toOtherWays = () => {
    net.hangUp();
    setView("more");
  };
  /* Offered only while somebody could still arrive. With every chair taken by
     me, a player at this screen or the game there is nothing to wait for and
     no room that can fill, and lobby.noChairs already says what to do about
     that — "if nothing is happening" would suggest something might still be
     coming. */
  const waiting = open.length > 0 && !ready;
  const roomEscape = (
    <div className="netescape">
      <p className="dek">{t("lobby.roomTrouble")}</p>
      <div className="row">
        <button className="btn small ghost" onClick={toOtherWays}>
          {t("btn.otherWays")}
        </button>
      </div>
    </div>
  );

  /* ==================== the host's table ==================== */
  if (net.role === "host")
    return (
      <Overlay>
        <h2>{t(net.room ? "lobby.roomTitle" : "lobby.hostTitle")}</h2>
        {/* The character's name, not seatName's "You": "sitting in You\'s chair"
            says nothing, and which chair the host took is the one fact this
            line carries. */}
        <p className="dek">
          {t(net.room ? "lobby.roomDek" : "lobby.hostDek", { who: SEATS[mine].name })}
        </p>
        {net.room && <RoomCode code={net.room} />}
        {open.length === 0 && <p className="dek">{t("lobby.noChairs")}</p>}
        {open.map((c) => (
          <div key={c.seat} className={cx("netchair", settled(c.state) && "on")}>
            <h3>
              {SEATS[c.seat].short} {seatName(c.seat, mine)} — {t(CHAIR_STATE[c.state])}
            </h3>
            {/* A room has one code for the whole table, so a chair on that
                route carries nothing to move: only its state. */}
            {!net.room && !settled(c.state) && c.code && (
              <>
                <p className="dek">
                  {c.complete
                    ? t("lobby.inviteReady")
                    : t("lobby.inviteGathering", { n: c.candidates })}
                </p>
                <CodeBlock code={c.code} label={t("lobby.yourCode")} />
                <label className="netlabel" htmlFor={`ans${c.seat}`}>
                  {t("lobby.theirCode")}
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
        {/* One invitation more, belonging to no chair: the shared display. Its
            own block, because it is not a seat at the table and reading it as
            one is the whole confusion this mode has to avoid. */}
        {net.tableInvite && (
          <div className={cx("netchair", settled(net.tableInvite.state) && "on")}>
            <h3>
              {t("lobby.tableChair")} — {t(CHAIR_STATE[net.tableInvite.state])}
            </h3>
            {!settled(net.tableInvite.state) && net.tableInvite.code && (
              <>
                <p className="dek">
                  {net.tableInvite.complete
                    ? t("lobby.inviteReady")
                    : t("lobby.inviteGathering", { n: net.tableInvite.candidates })}
                </p>
                <CodeBlock code={net.tableInvite.code} label={t("lobby.yourCode")} />
                <label className="netlabel" htmlFor="anstable">
                  {t("lobby.theirCode")}
                </label>
                <textarea
                  id="anstable"
                  className="codebox"
                  rows={3}
                  value={tableAnswer}
                  onChange={(e) => setTableAnswer(e.target.value)}
                />
                <div className="row">
                  <button className="btn small" onClick={() => net.connect("table", tableAnswer)}>
                    {t("btn.connect")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {net.problem && <p className="warn">{t(WHY[net.problem])}</p>}
        <p className="dek">{ready ? t("lobby.allHere") : t("lobby.needAll")}</p>
        {net.room && waiting && roomEscape}
        {/* Sticky, like every other footer in the lobby, and this is the page
            that proved the rule: one code, one QR and one box for the other
            player's code per open chair is 662px of panel in a 500px window
            with a single chair, and an ordinary footer sat at top 560 — below
            the fold, returning nothing from elementFromPoint, with Start the
            match and Back reachable only at the very end of the scroll. What
            it costs is a code box passing underneath mid-scroll, which is the
            trade #declpanel already takes. Measured in src/index.css. */}
        <div className="row lobbyfoot">
          <button className="btn" disabled={!ready} onClick={() => net.start()}>
            {t("btn.startMatch")}
          </button>
          <button className="btn ghost" onClick={back}>
            {t("btn.back")}
          </button>
        </div>
      </Overlay>
    );

  /* ==================== a guest, or the shared table, waiting ============ */
  if (net.role === "guest" || net.role === "table")
    return (
      <Overlay>
        <h2>{t("lobby.joinTitle")}</h2>
        <p className="dek">{t(net.room ? "lobby.roomWait" : "lobby.answerHint")}</p>
        {net.room ? (
          <RoomCode code={net.room} />
        ) : (
          net.answer && <CodeBlock code={net.answer} label={t("lobby.yourCode")} />
        )}
        {/* A table's seat is null exactly as an unwelcomed guest's is, so the
            role is what tells the two apart — without this branch a shared
            display would sit on "waiting for the host" for the whole match. */}
        <p className="dek">
          {net.role === "table"
            ? net.status === "live"
              ? t("lobby.tableSeated")
              : t("lobby.tableWaiting")
            : net.seat === null
              ? t("lobby.waitingHost")
              : t("lobby.seated", { who: SEATS[net.seat].name })}
        </p>
        {net.room && net.seat === null && roomEscape}
        <div className="row lobbyfoot">
          <button className="btn ghost" onClick={back}>
            {t("btn.back")}
          </button>
        </div>
      </Overlay>
    );

  /* ==================== other ways to connect ==================== */
  if (view === "more")
    return (
      <OtherWays
        joining={guestSide}
        mine={mine}
        code={hostCode}
        setCode={setHostCode}
        joinAs={joinAs}
        setJoinAs={setJoinAs}
        onBack={() => {
          setLinked(false);
          setView(joining ? "join" : "pick");
        }}
      />
    );

  /* ==================== joining: the room, and nothing else ============== */
  if (view === "join")
    return (
      <Overlay>
        <h2>{t("lobby.joinTitle")}</h2>
        <p className="dek">{t("lobby.roomHint")}</p>
        <label className="netlabel" htmlFor="roomcode">
          {t("lobby.roomCode")}
        </label>
        <input
          id="roomcode"
          className="codebox roominput"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
        />
        <JoinAs as={joinAs} setAs={setJoinAs} />
        {/* The footer is sticky here as it is on every other page of the
            lobby, and this is the page that needs it least: one route is a
            heading, a line, a label and a one-line box, so it does not
            scroll at all. Measured over CDP — 251px of panel in 500px at
            1280x500 and 291px in 844px at 390x844, an overlay that cannot
            scroll at either, and elementFromPoint returning each of the
            three buttons at its own centre. */}
        <div className="row lobbyfoot">
          <button className="btn" onClick={() => net.enterRoom(roomCode, joinAs)}>
            {t("btn.joinRoom")}
          </button>
          <button className="btn ghost" onClick={() => setView("more")}>
            {t("btn.otherWays")}
          </button>
          <button className="btn ghost" onClick={back}>
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
      <ModePick />
      <p className="dek">{t("lobby.readable")}</p>
      <p className="dek">{t("lobby.roomRelay")}</p>
      <p className="dek">{t("lobby.startNote")}</p>
      <div className="row lobbyfoot">
        {/* Always enabled: a "me" chair always exists, so there is always
            somebody to play, and an open chair nobody answered is played by
            the game rather than blocking the button with a reason the player
            cannot see. */}
        <button className="btn" onClick={() => net.start()}>
          {t("btn.startMatch")}
        </button>
        <button className="btn ghost" onClick={() => net.openRoom(mine)}>
          {t("btn.openRoom")}
        </button>
        {/* The room is the way to connect, and the second route is named for
            what it is one level down: this footer is inside the path the
            player entered by choosing Host, so it offers no way to join. */}
        <button className="btn ghost" onClick={() => setView("more")}>
          {t("btn.otherWays")}
        </button>
        <button className="btn ghost" onClick={back}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}

/* The second way to connect, one level down and named for the one thing a
   room never asks for: two players swapping two codes. One component for both
   sides of that swap, because the page differs by a label and a button and the
   route is the same route — and one row, written as a literal, because a
   second method is what would introduce a shape for a list of them. */
function OtherWays({
  joining,
  mine,
  code,
  setCode,
  joinAs,
  setJoinAs,
  onBack,
}: {
  joining: boolean;
  mine: Seat;
  code: string;
  setCode: (s: string) => void;
  joinAs: GuestRole;
  setJoinAs: (as: GuestRole) => void;
  onBack: () => void;
}) {
  const net = useNet();
  const { t } = useI18n();
  return (
    <Overlay>
      <h2>{t("lobby.moreTitle")}</h2>
      <div className="methods">
        <div className="method">
          <h3>{t("lobby.swapTitle")}</h3>
          <p className="dek">{t("lobby.swapWhy")}</p>
          {/* The joining side pastes what it was given; the hosting side has
              nothing to paste, because its own codes are built one per open
              chair once the swap has started. */}
          {joining && (
            <>
              <label className="netlabel" htmlFor="hostcode">
                {t("lobby.theirCode")}
              </label>
              <textarea
                id="hostcode"
                className="codebox"
                rows={4}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </>
          )}
          {joining ? <JoinAs as={joinAs} setAs={setJoinAs} /> : <TableSwitch />}
          {/* The switch belongs to this route and only to it: a room's
              signalling crosses a public relay whatever it is set to, so on a
              room's page the label would promise privacy it cannot give. */}
          <LanSwitch />
          {net.problem && <p className="warn">{t(WHY[net.problem])}</p>}
          <div className="row">
            {joining ? (
              <button className="btn" onClick={() => net.join(code, joinAs)}>
                {t("btn.swapCodes")}
              </button>
            ) : (
              <button className="btn" onClick={() => net.invite(mine)}>
                {t("btn.swapHost")}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Back to the page this was reached from: the chair table on the
          hosting side, the room's code box on the joining side. */}
      <div className="row lobbyfoot">
        <button className="btn ghost" onClick={onBack}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}

/* The mode the lobby starts, picked where it is started: the name and the
   description come from the mode's own CHALLENGES row, so one catalogue entry
   names it everywhere it is offered. The best line is the one the challenges
   list used to carry — a board whose best row is a loss reads as no result
   yet, because the line is about a match won — and it is read from the chosen
   mode's own board, since the two scales are two keys.

   The choice lives on the net context beside the chair plan, never on
   GameState and never in a save: what Start dispatches is a property of the
   window that is hosting, and a guest learns the mode from the host's numbered
   action. */
const MATCH_MODES: MatchId[] = ["race", "tuppi"];

function ModePick() {
  const net = useNet();
  const { t, fmt, nameOf, descOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === net.match) ?? CHALLENGES[0];
  const best = readRaceScores(net.match)[0];
  return (
    <div className="lobbymode">
      <h3>{t("lobby.mode")}</h3>
      <div className="modepicks">
        {MATCH_MODES.map((m) => (
          <button
            key={m}
            className={cx("kind", net.match === m && "on")}
            data-mode={m}
            onClick={() => net.setMatch(m)}
          >
            {nameOf(CHALLENGES.find((c) => c.id === m) ?? CHALLENGES[0])}
          </button>
        ))}
      </div>
      <p className="dek">{descOf(row)}</p>
      <p className="dek">
        {best?.won ? t("race.bestWon", { deals: fmt(best.deals) }) : t("challenges.noBest")}
      </p>
    </div>
  );
}

/* Which of the two things this device is, asked before it connects on every
   route into a session: the room's eight characters, a pasted code, and the QR
   deep link that fills the box for you. The host cannot tell a phone from a
   television, and a display seated as a player is a chair the match would wait
   on for ever.

   The room is the way people will actually join, so it is the way a display
   joins too: `hostSeating` sets a chair aside on the hello rather than on the
   arrival, which is what lets a device say it wants none. */
function JoinAs({ as, setAs }: { as: GuestRole; setAs: (as: GuestRole) => void }) {
  const { t } = useI18n();
  return (
    <div className="joinas">
      <span className="netlabel">{t("lobby.joinAs")}</span>
      <span className="kinds">
        {(["player", "table"] as GuestRole[]).map((k) => (
          <button
            key={k}
            className={cx("kind", as === k && "on")}
            data-as={k}
            onClick={() => setAs(k)}
          >
            {t(AS_LABEL[k])}
          </button>
        ))}
      </span>
      <span className="dek">{t(AS_DEK[as])}</span>
    </div>
  );
}

/* One invitation more, for a screen nobody sits at. Read inside invite(), so
   it has to be on before anybody is invited: turning it on afterwards builds
   no link, and always building a fifth peer connection would spend ICE
   gathering and a STUN round trip on a connection most hosts do not want. */
function TableSwitch() {
  const net = useNet();
  const { t } = useI18n();
  return (
    <label className="lanswitch">
      <input
        type="checkbox"
        checked={net.wantTable}
        onChange={(e) => net.setWantTable(e.target.checked)}
      />
      <span>{t("lobby.wantTable")}</span>
      <span className="dek">{t("lobby.wantTableDek")}</span>
    </label>
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
