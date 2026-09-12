import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { hashState, normalizePlayerName } from "../net/protocol";
import { guestLink, hostLink, type Link } from "../net/rtc";
import { openRoom as openTrysteroRoom, type Room } from "../net/room";
import { guestSeating, waitingRoomSeating, type GuestHost } from "../net/seating";
import {
  guestSession,
  hostSession,
  type GuestSession,
  type HostSession,
  type SessionStatus,
} from "../net/session";
import {
  OFF_CHAIRS,
  type ChairKind,
  type Net,
  type NetChair,
  type NetInvite,
  type NetRole,
  type SdpProblem,
} from "./netContext";
import type { GuestRole } from "../net/protocol";
import type { RoomPlayer } from "../net/protocol";
import { makeSeed } from "../game/rng";
import type { Action } from "../game/actions";
import type { GameState, MatchId, Seat, SeatKind } from "../game/types";

/* ============================ the session, wired to the store ==============
   GameProvider owns this the way it owns the clock. It holds the peer
   connections in refs, the session in a ref, and everything the lobby draws in
   React state — none of it in GameState, because a peer's connection state is
   a property of the window and the state has to be byte-identical on every
   peer.

   The one thing it changes about the rest of the app is the dispatch it hands
   down. Offline that dispatch is the reducer's own; in a session it is the
   relay's, and every component keeps calling it exactly as before — including
   useGameLoop, whose ticks the relay drops on a guest and numbers on the
   host. That is the whole integration: one function, swapped. */
/* The two actions that build a run out of a seed. Sent over the wire without
   one, every peer would call normalizeSeed(undefined) and draw its own — a
   divergence on action number one, before a card is dealt. The seed is drawn
   here, once, on the window that clicked, and travels with the action.

   Offline nothing is stamped: normalizeSeed already draws a seed in the
   reducer and an action reaching it unchanged is what every existing test
   inspects. */
function seeded(a: Action): Action {
  if (a.type !== "newRun" && a.type !== "startChallenge") return a;
  return a.seed ? a : { ...a, seed: makeSeed() };
}

export function useNetGame(state: GameState, dispatch: Dispatch<Action>): Net {
  const [role, setRole] = useState<NetRole>("off");
  const [chairs, setChairs] = useState<NetChair[]>(OFF_CHAIRS);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [problem, setProblem] = useState<SdpProblem | null>(null);
  const [lan, setLan] = useState(false);
  const [tableInvite, setTableInvite] = useState<NetInvite | null>(null);
  const [match, setMatch] = useState<MatchId>("race");
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<readonly RoomPlayer[]>([]);

  const host = useRef<HostSession | null>(null);
  const guest = useRef<GuestSession | null>(null);
  /* Keyed by the chair the link belongs to, and "table" for the one that
     belongs to none. */
  const links = useRef(new Map<Seat | "table", Link>());
  const byPeer = useRef(new Map<string, Link>());
  /* The room itself. Which chair each arrival was given, and which peer
     turned out to be the host, are seating.ts's — they are decisions, and
     they are tested where no browser is involved. */
  const roomRef = useRef<Room | null>(null);
  /* The callbacks below are created once and must not read a stale render. */
  const roleRef = useRef<NetRole>("off");
  const chairsRef = useRef<NetChair[]>(chairs);
  chairsRef.current = chairs;
  const lanRef = useRef(lan);
  lanRef.current = lan;
  /* Same shape as lanRef, and for the same reason: start() is a callback made
     once, and the mode it sends must be the one the picker shows on the click
     rather than the one it showed when the callback was built. */
  const matchRef = useRef(match);
  matchRef.current = match;

  const patch = useCallback((p: Seat, over: Partial<NetChair>) => {
    setChairs((cs) => cs.map((c) => (c.seat === p ? { ...c, ...over } : c)));
  }, []);

  /* Every dispatch in the app. Offline it is the reducer's; in a session the
     relay decides what is local, what is a request and what is dropped. */
  const send = useCallback(
    (a: Action) => {
      const session: { intent: (a: Action) => void } | null =
        roleRef.current === "host"
          ? host.current
          : roleRef.current === "off"
            ? null
            : /* a guest, or the shared table, which drops everything but the
                 window's own */
              guest.current;
      if (!session) {
        dispatch(a);
        return;
      }
      session.intent(seeded(a));
    },
    [dispatch],
  );

  /* A chair is a person or the game, and the connection is the only thing that
     can make an open chair a person: an invitation nobody answered is a chair
     the AI plays. "me" needs no peer. A chair whose invitation was answered
     by the shared table is not "connected" either: that device holds no chair,
     so the game plays it. */
  const seatsFor = useCallback(
    (): [SeatKind, SeatKind, SeatKind, SeatKind] =>
      chairsRef.current.map((c) =>
        c.kind === "me" || (c.kind === "open" && c.state === "connected") ? "human" : "ai",
      ) as [SeatKind, SeatKind, SeatKind, SeatKind],
    [],
  );

  const hangUp = useCallback(() => {
    for (const link of links.current.values()) link.close();
    links.current.clear();
    byPeer.current.clear();
    roomRef.current?.close();
    roomRef.current = null;
    setRoom(null);
    host.current = null;
    guest.current = null;
    roleRef.current = "off";
    setRole("off");
    setSeat(null);
    setStatus(null);
    setAnswer(null);
    setProblem(null);
    setChairs(OFF_CHAIRS);
    setTableInvite(null);
    setPlayers([]);
  }, []);

  const setChair = useCallback((p: Seat, kind: ChairKind) => {
    setChairs((cs) =>
      cs.map((c) =>
        c.seat === p
          ? { ...c, kind }
          : /* Only one chair is mine. */
            kind === "me" && c.kind === "me"
            ? { ...c, kind: "ai" }
            : c,
      ),
    );
  }, []);

  /* ==================== the host ==================== */
  /* Taking a chair, which is where both host routes begin: mine becomes
     "me", a chair that was "me" goes back to the game, and every chair
     starts from idle. */
  const planFor = useCallback(
    (mine: Seat): NetChair[] =>
      chairsRef.current.map((c) =>
        c.seat === mine
          ? { ...c, kind: "me" as ChairKind, state: "idle" as const }
          : { ...c, kind: c.kind === "me" ? ("ai" as ChairKind) : c.kind, state: "idle" as const },
      ),
    [],
  );

  const invite = useCallback(
    (mine: Seat) => {
      const plan = planFor(mine);
      setChairs(plan);
      setSeat(mine);
      setRole("host");
      roleRef.current = "host";

      const session = hostSession({
        send: (peer, text) => byPeer.current.get(peer)?.send(text),
        apply: (a) => dispatch(a),
        onStatus: (s) => setStatus(s),
        /* The welcome, and the only thing that marks an invitation answered —
           a chair's or the shared table's. hostSession calls this once it has
           seated the peer, so it says a person is here rather than that some
           device opened a channel: a peer on another NET_VERSION, or one that
           asked for a chair the invitation does not reserve, opens the channel
           and is then refused with `bye`, and a chair marked "connected" by
           the channel alone would be a human seat with nobody behind it — the
           stall nextTick has no way out of.

           The joining device's answer is authoritative in both directions: a
           device that took a chair's invitation and said "table" holds no
           chair, so that chair goes back to the game rather than waiting for
           clicks that will never come. */
        onGuest: (_peer, as, chair) => {
          if (chair === null) {
            if (as === "table") setTableInvite((v) => (v ? { ...v, state: "connected" } : v));
            return;
          }
          patch(chair, { state: as === "table" ? "table" : "connected" });
        },
      });
      host.current = session;

      for (const chair of plan) {
        if (chair.kind !== "open") continue;
        const p = chair.seat;
        patch(p, { state: "inviting" });
        /* The link is needed inside its own callbacks, so it is held rather
           than closed over. */
        const held: { link: Link | null } = { link: null };
        void hostLink(lanRef.current, {
          /* Deliberately not "connected". An open data channel says a device
             answered, not that hostSession admitted it: a build one
             NET_VERSION out of step opens the channel and is then refused
             with `bye`, and seatsFor() maps a connected open chair to
             "human" — a seat with nobody behind it, which nextTick waits on
             for ever. The welcome is the honest signal and arrives through
             onGuest above. */
          onOpen: () => {},
          onMessage: (text) => {
            if (held.link) session.receive(held.link.id, text);
          },
          onClose: () => patch(p, { state: "failed" }),
          onProgress: (n, complete) =>
            patch(p, { candidates: n, complete, code: held.link?.code() ?? null }),
        })
          .then((link) => {
            held.link = link;
            links.current.set(p, link);
            byPeer.current.set(link.id, link);
            session.join(link.id, p);
            patch(p, { state: "waiting", code: link.code() });
            void link.gathered.then(() => patch(p, { complete: true, code: link.code() }));
          })
          /* A browser with WebRTC switched off, or a configuration it
             refuses. The chair says so rather than sitting on "building an
             invitation" for ever. */
          .catch(() => patch(p, { state: "failed" }));
      }

      /* One invitation more, belonging to no chair: the scenario is four
         people with phones around one big screen, which leaves no chair to
         sacrifice. Built every time, because asking first decided nothing — a
         screen could always answer a chair's code and say "table" instead.
         What it costs is one peer connection, its ICE gathering and, unless
         LAN only is on, one STUN round trip, on the route that is already the
         slow manual one. */
      setTableInvite({ code: null, candidates: 0, complete: false, state: "inviting" });
      const shared: { link: Link | null } = { link: null };
      void hostLink(lanRef.current, {
        /* Deliberately not "connected", the same as a chair's above and with
           one more reason of its own: a device that answers this code and says
           "player" is refused by hostSession with `bye` and `nochair`, and
           settled() in Lobby.tsx reads "connected". Written on the channel
           alone, the block would stop drawing its code, its QR and its Connect
           — the host loses the only way to hand the invitation out again, and
           the line reads as a display that is in when nothing was admitted. */
        onOpen: () => {},
        onMessage: (text) => {
          if (shared.link) session.receive(shared.link.id, text);
        },
        onClose: () => setTableInvite((v) => (v ? { ...v, state: "failed" } : v)),
        onProgress: (n, complete) =>
          setTableInvite((v) =>
            v ? { ...v, candidates: n, complete, code: shared.link?.code() ?? null } : v,
          ),
      })
        .then((link) => {
          shared.link = link;
          links.current.set("table", link);
          byPeer.current.set(link.id, link);
          /* No session.join: this link reserves no chair, and the host keeps
             the peer at its hello instead. */
          setTableInvite((v) => (v ? { ...v, state: "waiting", code: link.code() } : v));
          void link.gathered.then(() =>
            setTableInvite((v) => (v ? { ...v, complete: true, code: link.code() } : v)),
          );
        })
        .catch(() => setTableInvite((v) => (v ? { ...v, state: "failed" } : v)));
    },
    [dispatch, patch, planFor],
  );

  /* ==================== the host, in a room ==================== */
  /* A room opens before anybody takes a chair. Devices enter a named roster,
     then the host assigns every player and Start freezes that map. */
  const openRoom = useCallback(() => {
    const hostName = normalizePlayerName(name);
    if (!hostName) return;
    setChairs(OFF_CHAIRS.map((chair) => ({ ...chair, kind: "ai" })));
    setSeat(null);
    setRole("host");
    roleRef.current = "host";

    const code = makeSeed();
    setRoom(code);

    const session = hostSession({
      send: (peer, text) => roomRef.current?.send(peer, text),
      apply: (a) => dispatch(a),
      onStatus: (s) => setStatus(s),
      onGuest: (_peer, as) => {
        if (as === "table")
          setTableInvite({ code: null, candidates: 0, complete: true, state: "connected" });
      },
      onLobby: (next) => {
        setPlayers(next);
        const hostPlayer = next.find((player) => player.id === "host");
        setSeat(hostPlayer?.seat ?? null);
        setChairs(
          OFF_CHAIRS.map((chair) => {
            const player = next.find((candidate) => candidate.seat === chair.seat);
            return {
              ...chair,
              kind: player ? (player.id === "host" ? "me" : "open") : "ai",
              state: player && player.id !== "host" ? "connected" : "idle",
            };
          }),
        );
      },
    });
    host.current = session;
    session.openLobby(hostName);

    roomRef.current = openTrysteroRoom(code, lanRef.current, waitingRoomSeating(session));
  }, [dispatch, name]);

  const assignPlayer = useCallback((id: string, assigned: Seat | null) => {
    host.current?.assign(id, assigned);
  }, []);

  const removePlayer = useCallback((id: string) => {
    host.current?.remove(id);
  }, []);

  const connect = useCallback((p: Seat | "table", code: string) => {
    const link = links.current.get(p);
    if (!link) return;
    /* take() rejects as well as refusing, and the two need different handling:
       a code the parser dislikes comes back as { ok: false }, while an answer
       handed to a link whose peer is already connected reaches
       setRemoteDescription on a stable connection, which throws. Without the
       second handler that is an unhandled rejection and nothing on screen. */
    void link.take(code).then(
      (r) => setProblem(r.ok ? null : r.why),
      () => setProblem("refused"),
    );
  }, []);

  /* The lobby starts a match, hosted or alone: the chairs are what pick the
     seats, the picker is what picks the mode, and the wrapped dispatch is what
     decides whether the action is numbered and broadcast or goes straight to
     the reducer. A guest has no picker — the mode arrives in the host's
     numbered action, exactly as the seed and the seats do. */
  const start = useCallback(
    (seed?: string) => {
      if (roomRef.current && !host.current?.canStart()) return;
      send({ type: "startChallenge", id: matchRef.current, seed, seats: seatsFor() });
    },
    [send, seatsFor],
  );

  /* ==================== a guest, or the shared table ==================== */
  const join = useCallback(
    (code: string, as: GuestRole) => {
      setProblem(null);
      const session = guestSession({
        send: (_peer, text) => links.current.get(0)?.send(text),
        apply: (a) => dispatch(a),
        onStatus: (s) => setStatus(s),
        onSeat: (p) => setSeat(p),
        as,
        name: as === "player" ? (normalizePlayerName(name) ?? undefined) : undefined,
      });
      const held: { link: Link | null } = { link: null };
      void guestLink(lanRef.current, code, {
        onOpen: () => session.hello(),
        onMessage: (text) => session.receive(text),
        onClose: () => setStatus("dropped"),
        onProgress: () => setAnswer(held.link?.code() ?? null),
      })
        .then((link) => {
          if ("ok" in link) {
            setProblem(link.why);
            return;
          }
          held.link = link;
          /* A guest has exactly one link, and its peer is the host. */
          links.current.set(0, link);
          guest.current = session;
          const mine: NetRole = as === "table" ? "table" : "guest";
          roleRef.current = mine;
          setRole(mine);
          setAnswer(link.code());
          void link.gathered.then(() => setAnswer(link.code()));
        })
        .catch(() => setStatus("dropped"));
    },
    [dispatch, name],
  );

  /* The code the host read out, typed. Normalised here rather than in the
     room, because the same string is the room's name and its password: a
     lower-case answer would land in a different room *and* fail to decrypt
     what it found there. */
  const enterRoom = useCallback(
    (raw: string, as: GuestRole) => {
      setProblem(null);
      const code = raw.trim().toUpperCase();
      const found: GuestHost = { id: null };
      const session = guestSession({
        send: (_peer, text) => {
          const r = roomRef.current;
          if (!r) return;
          /* Until the host has answered, everybody in the room gets the
             hello. Only the host replies with a welcome, and no guest ever
             messages another. */
          if (found.id) r.send(found.id, text);
          else for (const p of r.peers()) r.send(p, text);
        },
        apply: (a) => dispatch(a),
        onStatus: (s) => setStatus(s),
        onSeat: (p) => setSeat(p),
        onLobby: (next) => setPlayers(next),
        as,
        name: as === "player" ? (normalizePlayerName(name) ?? undefined) : undefined,
      });
      guest.current = session;
      /* A display in a room is the same peer a display on the other route is:
         it holds no chair, `guestSession` drops everything it tries to send,
         and the window draws no control that would move the game. The room is
         only how it was introduced. */
      const mine: NetRole = as === "table" ? "table" : "guest";
      roleRef.current = mine;
      setRole(mine);
      setRoom(code);

      roomRef.current = openTrysteroRoom(
        code,
        lanRef.current,
        guestSeating(session, found, () => setStatus("dropped")),
      );
    },
    [dispatch, name],
  );

  /* The hash of the state this render is showing. React's dispatch is not
     synchronous, so the session cannot hash at the moment it applies; it is
     told here instead, and it knows which numbered action this render
     reflects. */
  useEffect(() => {
    const session: { localHash: (h: string) => void } | null = host.current ?? guest.current;
    if (!session) return;
    session.localHash(hashState(state));
  }, [state]);

  return useMemo(
    () => ({
      role,
      live: role !== "off",
      seat,
      status,
      chairs,
      room,
      answer,
      problem,
      lan,
      tableInvite,
      name,
      setName,
      players,
      assignPlayer,
      removePlayer,
      canStart:
        role === "host" && players.length > 0 && players.every((player) => player.seat !== null),
      setLan,
      match,
      setMatch,
      setChair,
      invite,
      openRoom,
      enterRoom,
      connect,
      join,
      start,
      hangUp,
      dispatch: send,
      seatsFor,
    }),
    [
      role,
      seat,
      status,
      chairs,
      room,
      answer,
      problem,
      lan,
      tableInvite,
      name,
      players,
      match,
      setChair,
      assignPlayer,
      removePlayer,
      invite,
      openRoom,
      enterRoom,
      connect,
      join,
      start,
      hangUp,
      send,
      seatsFor,
    ],
  );
}
