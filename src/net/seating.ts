import { parseMsg } from "./protocol";
import type { GuestSession, HostSession } from "./session";
import type { Seat } from "../game/types";

/* ============================ a room's two sides ============================
   What a room does to a session, with no room in the file: the events a peer
   mesh produces — somebody arrived, somebody left, somebody said something —
   turned into the calls session.ts already understands.

   It is separate from room.ts for the same reason session.ts is separate from
   rtc.ts: this is where the decisions are, and decisions are worth testing
   without a browser. room.ts is the door, and holds none of them.

   The decision that needs stating is who gets which chair. A room has one
   code for the whole table, so the code cannot say which chair it is for:
   arrivals take the open chairs in seat order, first come first served. The
   manual route is the one that can promise a named chair.

   **A chair is set aside by the hello, not by the arrival.** What arrives at a
   room is a device, and the room code cannot say what kind: a shared display
   joins by the same eight characters everybody else types, and a chair
   reserved for one would be a chair no player could take. The hello is the
   first thing that says which of the two the device is, so that is where the
   chair is claimed — and the claim is provisional, because the host still
   refuses a peer a version out of step or one that arrived late. */

export type RoomEvents = {
  /* A peer's channel is open. On the host that is when a chair is set aside
     for it; on a guest, when there is somebody to say hello to. */
  onPeer: (peer: string) => void;
  onDrop: (peer: string) => void;
  onMessage: (peer: string, text: string) => void;
};

export function hostSeating(
  session: HostSession,
  open: Seat[],
  /* A chair whose peer is gone. The other direction — a chair whose peer is
     *here* — is the welcome's to report, through hostSession's `onGuest`: a
     chair marked connected by a message alone is a human seat with nobody
     behind it whenever the host then refuses the peer, and nextTick waits on
     such a seat for ever. */
  onFree: (seat: Seat) => void,
): RoomEvents {
  const taken = new Map<Seat, string>();
  const release = (p: Seat) => void taken.delete(p);

  /* What the hello claims. `null` is a peer that needs no chair — a shared
     display, or one this host has already answered — and "full" is a table
     with nothing left to give. */
  const claim = (peer: string, text: string): Seat | null | "full" => {
    /* Already answered: seated at a chair, or welcomed holding none. */
    if (session.seatOf(peer) !== undefined) return null;
    const m = parseMsg(text);
    /* Only a hello asks the question. Anything else from a peer the host has
       not welcomed is dropped by the session itself, and a chair spent on a
       stray message is a chair no player can take. */
    if (!m || m.t !== "hello") return null;
    /* The display holds none, and hostSession welcomes it with `seat: null`
       on the strength of that word alone — the same answer the chairless
       invitation gets on the other route. */
    if (m.as === "table") return null;
    const free = open.find((p) => !taken.has(p));
    if (free === undefined) {
      /* Anybody holding the code can arrive, so a full table is an ordinary
         answer and not an error: the peer is turned away rather than left
         waiting for a welcome that will never come. */
      session.refuse(peer);
      return "full";
    }
    taken.set(free, peer);
    session.join(peer, free);
    return free;
  };

  return {
    /* Nothing to do: a chair is set aside by the hello, which is the first
       thing that says whether the device wants one at all. */
    onPeer: () => {},
    onDrop: (peer) => {
      session.leave(peer);
      for (const [p, id] of taken) {
        if (id !== peer) continue;
        release(p);
        onFree(p);
      }
    },
    /* A message can outrun its own arrival event, and now it is the message
       that seats the peer, so nothing here depends on the order of the two. */
    onMessage: (peer, text) => {
      const seat = claim(peer, text);
      if (seat === "full") return;
      session.receive(peer, text);
      /* The claim was provisional. hostSession refuses a peer on another
         NET_VERSION and one that arrived after the first action was numbered,
         and neither is in the broadcast set afterwards — so a chair still
         held for a device that was never welcomed goes back to the room. */
      if (seat !== null && session.seatOf(peer) === undefined) release(seat);
    },
  };
}

/* Room-first admission: a player enters the roster with no chair. The host
   assigns chairs later through HostSession.assign; tables remain chairless. */
export function waitingRoomSeating(session: HostSession): RoomEvents {
  return {
    onPeer: () => {},
    onDrop: (peer) => session.leave(peer),
    onMessage: (peer, text) => {
      const message = parseMsg(text);
      if (message?.t === "hello" && message.as === "player") session.wait(peer);
      session.receive(peer, text);
    },
  };
}

/* Which peer turned out to be the host. A guest's session is built before its
   seating — its `send` needs somewhere to aim — so the answer is held in a
   box both of them share rather than being read back out of the seating. */
export type GuestHost = { id: string | null };

export function guestSeating(
  session: GuestSession,
  host: GuestHost,
  onHostDrop: () => void,
): RoomEvents {
  return {
    /* Greet whoever turns up, but only while the host has not answered: a
       second hello after the first action is numbered is what the host turns
       away as late. The question is `welcomed` and not `seat`, because the
       shared table is welcomed with no chair at all — a seat test would have
       it greeting every later arrival and being thrown out of a match it was
       already watching. */
    onPeer: () => {
      if (!session.welcomed()) session.hello();
    },
    onDrop: (peer) => {
      if (peer === host.id) onHostDrop();
    },
    /* Nobody but the host ever messages a guest — the relay is a star, not a
       mesh — so the first message to arrive is what says which peer it is. */
    onMessage: (peer, text) => {
      host.id ??= peer;
      if (peer === host.id) session.receive(text);
    },
  };
}
