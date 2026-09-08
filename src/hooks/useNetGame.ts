import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { hashState } from "../net/protocol";
import { guestLink, hostLink, type Link } from "../net/rtc";
import { openRoom as openTrysteroRoom, type Room } from "../net/room";
import { guestSeating, hostSeating, type GuestHost } from "../net/seating";
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
  type NetRole,
  type SdpProblem,
} from "./netContext";
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
  const [match, setMatch] = useState<MatchId>("race");

  const host = useRef<HostSession | null>(null);
  const guest = useRef<GuestSession | null>(null);
  const links = useRef(new Map<Seat, Link>());
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
          : roleRef.current === "guest"
            ? guest.current
            : null;
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
     the AI plays. "me" and "hot" are people at this screen, so they need no
     peer at all — which is what keeps a one-screen race startable with no
     session. */
  const seatsFor = useCallback(
    (): [SeatKind, SeatKind, SeatKind, SeatKind] =>
      chairsRef.current.map((c) =>
        c.kind === "me" || c.kind === "hot" || (c.kind === "open" && c.state === "connected")
          ? "human"
          : "ai",
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
          onOpen: () => patch(p, { state: "connected" }),
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
    },
    [dispatch, patch, planFor],
  );

  /* ==================== the host, in a room ==================== */
  /* The same session, reached the way a player will actually reach it: one
     code for the whole table, read out loud. What differs from `invite` is
     only who introduces the peers — Trystero rather than the players — and
     that chairs are handed to arrivals in seat order, because a room code
     cannot say which chair it is for. */
  const openRoom = useCallback(
    (mine: Seat) => {
      const plan = planFor(mine);
      setChairs(plan);
      setSeat(mine);
      setRole("host");
      roleRef.current = "host";

      const code = makeSeed();
      setRoom(code);

      const session = hostSession({
        send: (peer, text) => roomRef.current?.send(peer, text),
        apply: (a) => dispatch(a),
        onStatus: (s) => setStatus(s),
      });
      host.current = session;
      for (const chair of plan) if (chair.kind === "open") patch(chair.seat, { state: "waiting" });

      /* `plan` and not chairsRef: the chair kinds are settled here, and
         reading them back through React state would race the render. */
      const open = plan.filter((c) => c.kind === "open").map((c) => c.seat);
      roomRef.current = openTrysteroRoom(
        code,
        lanRef.current,
        hostSeating(session, open, (p, state) => patch(p, { state })),
      );
    },
    [dispatch, patch, planFor],
  );

  const connect = useCallback((p: Seat, code: string) => {
    const link = links.current.get(p);
    if (!link) return;
    void link.take(code).then((r) => {
      if (r.ok) setProblem(null);
      else setProblem(r.why);
    });
  }, []);

  /* The lobby starts a match, hosted or alone: the chairs are what pick the
     seats, the picker is what picks the mode, and the wrapped dispatch is what
     decides whether the action is numbered and broadcast or goes straight to
     the reducer. A guest has no picker — the mode arrives in the host's
     numbered action, exactly as the seed and the seats do. */
  const start = useCallback(
    (seed?: string) => {
      send({ type: "startChallenge", id: matchRef.current, seed, seats: seatsFor() });
    },
    [send, seatsFor],
  );

  /* ==================== a guest ==================== */
  const join = useCallback(
    (code: string) => {
      setProblem(null);
      const session = guestSession({
        send: (_peer, text) => links.current.get(0)?.send(text),
        apply: (a) => dispatch(a),
        onStatus: (s) => setStatus(s),
        onSeat: (p) => setSeat(p),
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
          roleRef.current = "guest";
          setRole("guest");
          setAnswer(link.code());
          void link.gathered.then(() => setAnswer(link.code()));
        })
        .catch(() => setStatus("dropped"));
    },
    [dispatch],
  );

  /* The code the host read out, typed. Normalised here rather than in the
     room, because the same string is the room's name and its password: a
     lower-case answer would land in a different room *and* fail to decrypt
     what it found there. */
  const enterRoom = useCallback(
    (raw: string) => {
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
      });
      guest.current = session;
      roleRef.current = "guest";
      setRole("guest");
      setRoom(code);

      roomRef.current = openTrysteroRoom(
        code,
        lanRef.current,
        guestSeating(session, found, () => setStatus("dropped")),
      );
    },
    [dispatch],
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
      match,
      setChair,
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
