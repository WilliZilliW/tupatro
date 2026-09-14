import { useState } from "react";
import { SEATS } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { readRaceScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { codeInHash } from "../../net/signal";
import { cx } from "../cx";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { QrCode } from "../net/QrCode";
import type { ChairState, Net, NetChair, SdpProblem } from "../../hooks/netContext";
import type { MatchId, Seat } from "../../game/types";
import type { LocaleKey } from "../../i18n";
import { PLAYER_NAME_MAX, type GuestRole, type RoomPlayer } from "../../net/protocol";

/* The lobby, which is where a game with other people is configured: the
   Tuppikilpa race and Traditional Tuppi, the two match modes. It is
   multiplayer-only. The roguelike left it with the door that used to open it —
   the start menu's Multiplayer button is what raises it now, and everything
   played against nobody but the game is behind Single player instead. That is
   why there is no roguelike gate here any more and no line explaining one: the
   mode the gate refused cannot be picked, cannot be typed and cannot be sent.

   The four chairs are the whole of who plays: each of them is this window's
   own player, an open chair a peer connects to, or the game. Start turns the
   chairs into `seats` and dispatches `startChallenge`, which offline goes
   straight to the reducer and in a session is numbered and broadcast like any
   other flow action.

   Nobody picks a chair by hand any more, and the first page no longer offers
   to. In a room the chairs follow the roster: devices enter by name, the host
   places every one of them, and Start freezes that map. On the code swap
   there is no roster to place anybody from, so taking a chair opens the other
   three and whichever nobody answers is played by the game. A You / Open / AI
   table drawn before either of those happened decided nothing on the room
   route — openRoom() throws every kind away — and stood on the same page as
   the line saying the host places the players once they have joined.

   Who sits where is not a rule of tuppi — the club's sheet and korttipeliopas
   both state every positional rule relative to the dealer or the elder hand,
   and neither names a seat for anybody. What the seat changes is which hand a
   given seed deals and where the rotating deal puts you.

   The chair rows are the seats in engine order, not the deal order: the
   dealer rotates on every startBlind and nextDeal, so "you declare first
   here" would be false after one deal.

   Everything the exchange needs is component-local useState or the net
   context. None of it is on GameState and none of it is in the save: the run
   this configures does not exist until Start is clicked, and a session is a
   property of the window.

   Like the end screens and the single-player screen, this reads a board while
   it renders — a mode's best result is not part of GameState — and it reads it
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

/* A named player in the room's roster who is not this window. `openLobby` puts
   the host itself in `players` under ROOM_HOST_ID, so every question about
   company has to exclude it: `players.length` is 1 on a room nobody has
   answered. */
const isOther = (player: RoomPlayer): boolean => player.id !== "host";

/* How many other people are in the room: the number the host compares against
   the people they are on a call with. A welcomed display is not a player — it
   holds no chair and lobby.tableSeated is its own line — so it is not counted
   here. */
const othersInRoom = (net: Net): number => net.players.filter(isOther).length;

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
  const { runStarted, challenge } = useGameState();
  const net = useNet();
  const { t, fmt, seatName } = useI18n();
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

     The display's own invitation gates nothing, and cannot: it is built for
     every code-swap host now, so an unanswered one says only that nobody has
     answered a code most hosts never hand out — gating on it would leave every
     one of them with a Start that never enables. Connected before Start is
     still the display's one precondition, since there is no reconnect and the
     host refuses a late arrival, and lobby.tableDek in its own block is what
     says so. */
  const ready =
    (open.length > 0 || net.tableInvite !== null) && open.every((c) => settled(c.state));
  /* How many other people are in the room, for the room-first page's own
     lines. It is the roster and not an open data channel: a RoomPlayer other
     than the host exists only once hostSession's `hello` case admitted it,
     which is the same honest signal onGuest gives the other route. */
  const others = othersInRoom(net);
  /* And the code swap's own version of that question, kept separate because
     the two pages count different things: a room has no chair invitations and
     no tableInvite of its own, while here a settled display *is* a device that
     turned up — it just holds no chair. Sharing one predicate would count a
     display on the room page, where a display is not a player. */
  const nobodyAnswered =
    !net.chairs.some((c) => settled(c.state)) &&
    !(net.tableInvite !== null && settled(net.tableInvite.state));
  /* The code swap's alone state: the exchange has nothing left to wait for and
     no device turned up, so the click starts a match of one. It is what the
     consequence line and the Start label are both drawn from, because a button
     that says one thing while the line above it says another is the untruth
     this page had, moved one element down. While a chair is still unanswered
     the label stays btn.startMatch: that Start is disabled, and naming the
     alone case there would promise an outcome the button cannot deliver. */
  const startsAlone = ready && nobodyAnswered;
  /* Back goes to the start menu, which is the only door left: Hang up lives
     in this footer now, so leaving the lobby no longer has to pass a view that
     held it. */
  const back = () => dispatch({ type: "showMenu", view: "start" });
  /* Hang up, wherever a session is live: the host's two pages, the guest's and
     the shared table's. It was behind the Multiplayer door, which is gone, and
     a player with no way to leave a session is a player who has to reload. */
  const hangUp = net.live && (
    <button className="btn ghost" onClick={net.hangUp}>
      {t("btn.hangUp")}
    </button>
  );
  /* The way back onto the felt from a menu opened mid-session, moved here from
     the start menu: the label reads the game already behind the menu, never
     the session, so an open room with no match started yet still reads "Back
     to game" rather than "Back to match". Gated on net.live even though every
     page below already branches on net.role — role !== "off" is exactly what
     live means, but the clause is written out so a live-gated control reads
     as one at the call site rather than depending on which page it sits on. */
  const returnLabel =
    challenge === "rummikub"
      ? "lobby.returnChallenge"
      : challenge !== null
        ? "lobby.returnMatch"
        : "lobby.returnGame";
  const returnBtn = net.live && runStarted && (
    <button className="btn ghost" onClick={() => dispatch({ type: "closeMenu" })}>
      {t(returnLabel)}
    </button>
  );
  /* Both modes park the run behind the menu rather than destroying it, so
     neither Start confirms anything — the same reason the alternate rule sets
     have never confirmed. */
  const start = () => net.start();
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

  const validName = net.name.trim().length > 0 && net.name.trim().length <= PLAYER_NAME_MAX;

  /* ==================== the room-first host lobby ==================== */
  if (net.role === "host" && net.room)
    return (
      <Overlay>
        <h2>{t("lobby.roomTitle")}</h2>
        <p className="dek">{t("lobby.roomDek")}</p>
        <RoomCode code={net.room} />
        {/* Who is actually here, drawn above the roster and the picker rather
            than beside the button. The panel scrolls on a 500px window and
            these three lines are the ones the click needs — drawn after the
            chair selects and the mode's own prose they sat ~140px below the
            fold, unread, on the page whose whole point is that the host stops
            being told the opposite. "Most important content first", the same
            rule the declaration panel and the shop's replace picker each
            learned the hard way.

            Four paragraphs and no wrapper: a div with no rule of its own is
            the trap `.railpage` recorded, and these lines need no box that
            `.dek` and `.warn` do not already give them. */}
        {/* The number, in all three states. The roster below is a list of one
            while nobody has answered, and net.canStart cannot tell the host
            the difference: it answers seating only, and the host seating
            itself satisfies it. */}
        <p className="dek">{t("lobby.othersHere", { n: fmt(others) })}</p>
        {/* Starting alone stays the host's to choose — Start is not gated on a
            second peer — but it is not a choice to make by accident: the first
            numbered action takes seq.n to 1 and hostSession refuses every
            later arrival for the rest of the match, with no reconnect and no
            catch-up. So the consequence is stated, and "Everyone is here." is
            withheld until somebody else actually is. */}
        {others === 0 && <p className="warn">{t("lobby.alone")}</p>}
        {net.canStart ? (
          others > 0 && <p className="dek">{t("lobby.allHere")}</p>
        ) : (
          <p className="dek">{t("lobby.needAssignments")}</p>
        )}
        {/* The display is not a player and does not turn the alone line off,
            but it is here, so it is read with the rest of who is here rather
            than under the mode picker. lobby.tableSeated is the display's own
            second-person line ("this device is..."); the host needs a line
            about the display, not one written as if it were reading its own
            screen. */}
        {net.tableInvite && <p className="dek">{t("lobby.tableJoined")}</p>}
        <h3>{t("lobby.players")}</h3>
        <div className="seatpicks">
          {net.players.map((player) => (
            <div key={player.id} className="seatpick">
              <span className="who">{player.name}</span>
              <span className="dek">
                {player.seat === null ? t("lobby.unassigned") : seatName(player.seat, net.seat)}
              </span>
              {player.id !== "host" && (
                <button className="btn small ghost" onClick={() => net.removePlayer(player.id)}>
                  {t("lobby.removePlayer")}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="seatpicks">
          {net.chairs.map((chair) => {
            const assigned = net.players.find((player) => player.seat === chair.seat);
            return (
              <label key={chair.seat} className="seatpick">
                <span className="av">{SEATS[chair.seat].short}</span>
                <span className="who">{seatName(chair.seat, net.seat)}</span>
                <span className="netlabel">{t("lobby.assignSeat")}</span>
                <select
                  value={assigned?.id ?? ""}
                  onChange={(event) => {
                    if (event.target.value) net.assignPlayer(event.target.value, chair.seat);
                    else if (assigned) net.assignPlayer(assigned.id, null);
                  }}
                >
                  <option value="">{t("lobby.emptyChair")}</option>
                  {net.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
        <ModePick />
        {roomEscape}
        <div className="row lobbyfoot">
          {/* The same button and the same enablement; only the label says
              which of the two things the click does. */}
          <MoveButton className="btn" disabled={!net.canStart} onClick={start}>
            {t(others > 0 ? "btn.startMatch" : "btn.startAlone")}
          </MoveButton>
          {returnBtn}
          {hangUp}
          <button className="btn ghost" onClick={back}>
            {t("btn.back")}
          </button>
        </div>
      </Overlay>
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
        {/* Every open chair has answered — or there was none to answer — but
            that is not the same as somebody being here: with no chair open and
            nothing but an unanswered display invitation, "Everyone is here."
            is a claim about an empty table. Start stays enabled either way;
            the sentence is what changes.

            Drawn above the chairs rather than above the footer, for the reason
            the room page's block is: one code, one QR and one answer box per
            chair is 662px of panel in a 500px window, so a line after them is
            a line the host scrolls past on the way to a sticky Start. The
            consequence carries .warn here exactly as it does there — the same
            sentence drawn as quiet prose on one page and a warning on the
            other says the two pages disagree about how much it matters. */}
        {ready ? (
          startsAlone ? (
            <p className="warn">{t("lobby.alone")}</p>
          ) : (
            <p className="dek">{t("lobby.allHere")}</p>
          )
        ) : (
          <p className="dek">{t("lobby.needAll")}</p>
        )}
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
            {/* Whose code this is, and the one thing Start no longer says. The
                code is always offered now, so a player may well paste it — the
                host refuses that with `nochair` — and the display cannot join
                a match already under way, which nothing else on the page
                would tell the host in time. */}
            {!settled(net.tableInvite.state) && <p className="dek">{t("lobby.tableDek")}</p>}
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
        {/* The picker is drawn wherever Start is, so the mode can still be
            changed after the codes have been built — and so the roguelike's
            refusal is read next to the button that refuses it. */}
        <ModePick />
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
          <MoveButton className="btn" disabled={!ready} onClick={start}>
            {t("btn.startMatch")}
          </MoveButton>
          {returnBtn}
          {hangUp}
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
        {/* No Start, no chairs and no mode picker: a guest is seated by the
            host and the shared table holds no chair at all, so the only thing
            either configures is whether it stays. That is what makes the table
            branch the useSpectating() answer for this whole screen — a table's
            role always lands here, never on the pages that pick. */}
        <div className="row lobbyfoot">
          {returnBtn}
          {hangUp}
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
        {joinAs === "player" && <NameField />}
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
          <button
            className="btn"
            disabled={joinAs === "player" && !validName}
            onClick={() => net.enterRoom(roomCode, joinAs)}
          >
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
      <NameField />
      {/* No chair is picked here any more. Who sits where is the room's
          question and the room's alone: the host opens a room, the others
          enter it by name, and the host places every one of them from the
          roster on the page below. A table of You / Open / AI drawn before any
          of that happened decided nothing on this route — openRoom() throws
          every kind away — and a page whose own line says the host places the
          players while offering to place them itself is the control that lies.
          The code swap has no roster to place anybody from, so it opens every
          chair but the host's and the game plays whichever nobody answers. */}
      <ModePick />
      <p className="dek">{t("lobby.readable")}</p>
      <p className="dek">{t("lobby.roomRelay")}</p>
      <p className="dek">{t("lobby.startNote")}</p>
      <div className="row lobbyfoot">
        {/* Enabled unless the roguelike is picked with somebody else here: a
            "me" chair always exists, so there is always somebody to play, and
            an open chair nobody answered is played by the game rather than
            blocking the button with a reason the player cannot see. */}
        <MoveButton className="btn" onClick={start}>
          {t("btn.startMatch")}
        </MoveButton>
        <button className="btn ghost" disabled={!validName} onClick={() => net.openRoom()}>
          {t("btn.openRoom")}
        </button>
        {/* The room is the way to connect, and the second route is named for
            what it is one level down. Joining is on this page too, because the
            menu no longer has a view between itself and here: a player who
            opened New game and then remembered they were the guest would
            otherwise have to go back for it. */}
        <button className="btn ghost" onClick={() => setView("join")}>
          {t("btn.joinGame")}
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
}

function NameField() {
  const net = useNet();
  const { t } = useI18n();
  return (
    <label className="netlabel">
      <span>{t("lobby.name")}</span>
      <input
        className="codebox roominput"
        maxLength={PLAYER_NAME_MAX}
        value={net.name}
        onChange={(event) => net.setName(event.target.value)}
      />
      <span className="dek">{t("lobby.nameHint")}</span>
    </label>
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
          {/* Only the joining side is asked what it is. The hosting side is
              asked nothing: every code swap builds the display's invitation
              beside the chairs', and whether a screen turns up is answered by
              the screen. */}
          {joining && <JoinAs as={joinAs} setAs={setJoinAs} />}
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

/* The mode the lobby starts, picked where it is started. Both are alternate
   rule sets, so their name and description come from their own CHALLENGES row
   and one catalogue entry names them everywhere they are offered.

   The roguelike is not among them and cannot be: it is a one-player game, the
   lobby is multiplayer-only, and `MatchId` makes the roguelike a compile error
   here rather than an option to filter out. It is started from the
   single-player screen instead.

   The best line reads the chosen mode's own board, since the two scales are
   two keys, and a board whose best row is a loss reads as no result yet —
   the line is about a match won.

   The choice lives on the net context beside the chair plan, never on
   GameState and never in a save: what Start dispatches is a property of the
   window that is hosting, and a guest learns the mode from the host's numbered
   action. */
const LOBBY_MODES: MatchId[] = ["race", "tuppi"];

const rowFor = (m: MatchId) => CHALLENGES.find((c) => c.id === m) ?? null;

function ModePick() {
  const net = useNet();
  const { t, fmt, nameOf, descOf } = useI18n();
  const row = rowFor(net.match);
  const best = readRaceScores(net.match)[0];
  return (
    <div className="lobbymode">
      <h3>{t("lobby.mode")}</h3>
      <div className="modepicks">
        {LOBBY_MODES.map((m) => {
          const r = rowFor(m);
          return (
            r && (
              <button
                key={m}
                className={cx("kind", net.match === m && "on")}
                data-mode={m}
                onClick={() => net.setMatch(m)}
              >
                {nameOf(r)}
              </button>
            )
          );
        })}
      </div>
      {row && <p className="dek">{descOf(row)}</p>}
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
