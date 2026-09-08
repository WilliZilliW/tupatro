import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { hashState } from "../net/protocol";
import { guestLink, hostLink, type Link } from "../net/rtc";
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
import type { Action } from "../game/actions";
import type { GameState, Seat, SeatKind } from "../game/types";

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
export function useNetGame(state: GameState, dispatch: Dispatch<Action>): Net {
  const [role, setRole] = useState<NetRole>("off");
  const [chairs, setChairs] = useState<NetChair[]>(OFF_CHAIRS);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [problem, setProblem] = useState<SdpProblem | null>(null);
  const [lan, setLan] = useState(false);

  const host = useRef<HostSession | null>(null);
  const guest = useRef<GuestSession | null>(null);
  const links = useRef(new Map<Seat, Link>());
  const byPeer = useRef(new Map<string, Link>());
  /* The callbacks below are created once and must not read a stale render. */
  const roleRef = useRef<NetRole>("off");
  const chairsRef = useRef<NetChair[]>(chairs);
  chairsRef.current = chairs;
  const lanRef = useRef(lan);
  lanRef.current = lan;

  const patch = useCallback((p: Seat, over: Partial<NetChair>) => {
    setChairs((cs) => cs.map((c) => (c.seat === p ? { ...c, ...over } : c)));
  }, []);

  /* Every dispatch in the app. Offline it is the reducer's; in a session the
     relay decides what is local, what is a request and what is dropped. */
  const send = useCallback(
    (a: Action) => {
      if (roleRef.current === "host" && host.current) host.current.intent(a);
      else if (roleRef.current === "guest" && guest.current) guest.current.intent(a);
      else dispatch(a);
    },
    [dispatch],
  );

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
  const invite = useCallback(
    (mine: Seat) => {
      const plan = chairsRef.current.map((c) =>
        c.seat === mine
          ? { ...c, kind: "me" as ChairKind, state: "idle" as const }
          : { ...c, kind: c.kind === "me" ? ("ai" as ChairKind) : c.kind, state: "idle" as const },
      );
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
    [dispatch, patch],
  );

  const connect = useCallback((p: Seat, code: string) => {
    const link = links.current.get(p);
    if (!link) return;
    void link.take(code).then((r) => {
      if (r.ok) setProblem(null);
      else setProblem(r.why);
    });
  }, []);

  const start = useCallback(
    (seed?: string) => {
      send({ type: "newRun", seed, seats: seatsFor() });
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
      answer,
      problem,
      lan,
      setLan,
      setChair,
      invite,
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
      answer,
      problem,
      lan,
      setChair,
      invite,
      connect,
      join,
      start,
      hangUp,
      send,
      seatsFor,
    ],
  );
}
