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
  type NetInvite,
  type NetRole,
  type SdpProblem,
} from "./netContext";
import type { GuestRole } from "../net/protocol";
import { makeSeed } from "../game/rng";
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
  const [problem, setProblem] = useState<SdpProblem | null>(null);
  const [lan, setLan] = useState(false);
  const [wantTable, setWantTable] = useState(false);
  const [tableInvite, setTableInvite] = useState<NetInvite | null>(null);

  const host = useRef<HostSession | null>(null);
  const guest = useRef<GuestSession | null>(null);
  /* Keyed by the chair the link belongs to, and "table" for the one that
     belongs to none. */
  const links = useRef(new Map<Seat | "table", Link>());
  const byPeer = useRef(new Map<string, Link>());
  /* The callbacks below are created once and must not read a stale render. */
  const roleRef = useRef<NetRole>("off");
  const chairsRef = useRef<NetChair[]>(chairs);
  chairsRef.current = chairs;
  const lanRef = useRef(lan);
  lanRef.current = lan;
  /* Read inside invite(), so the switch has to be set before anybody is
     invited: turning it on afterwards builds no link, and always building a
     fifth peer connection would spend ICE gathering and a STUN round trip on a
     connection most hosts do not want. */
  const wantTableRef = useRef(wantTable);
  wantTableRef.current = wantTable;

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
     the AI plays. "me" and "hot" are people at this screen, so they need no
     peer at all — which is what keeps a one-screen race startable with no
     session. A chair whose invitation was answered by the shared table is not
     "connected" either: that device holds no chair, so the game plays it. */
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
        /* The joining device's answer is authoritative in both directions: a
           device that took a chair's invitation and said "table" holds no
           chair, so that chair goes back to the game rather than waiting for
           clicks that will never come. */
        onGuest: (_peer, as, chair) => {
          if (as !== "table") return;
          if (chair === null) {
            setTableInvite((v) => (v ? { ...v, state: "connected" } : v));
            return;
          }
          patch(chair, { state: "table" });
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

      /* One invitation more, belonging to no chair: the scenario is four
         people with phones around one big screen, which leaves no chair to
         sacrifice. Off by default, and read here rather than at connect time,
         so a host who does not want a shared display builds no fifth peer
         connection at all. */
      if (!wantTableRef.current) return;
      setTableInvite({ code: null, candidates: 0, complete: false, state: "inviting" });
      const shared: { link: Link | null } = { link: null };
      void hostLink(lanRef.current, {
        onOpen: () => setTableInvite((v) => (v ? { ...v, state: "connected" } : v)),
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
    [dispatch, patch],
  );

  const connect = useCallback((p: Seat | "table", code: string) => {
    const link = links.current.get(p);
    if (!link) return;
    void link.take(code).then((r) => {
      if (r.ok) setProblem(null);
      else setProblem(r.why);
    });
  }, []);

  /* The lobby starts a race, hosted or alone: the chairs are what pick the
     seats and the wrapped dispatch is what decides whether the action is
     numbered and broadcast or goes straight to the reducer. */
  const start = useCallback(
    (seed?: string) => {
      send({ type: "startChallenge", id: "race", seed, seats: seatsFor() });
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
      tableInvite,
      wantTable,
      setWantTable,
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
      tableInvite,
      wantTable,
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
