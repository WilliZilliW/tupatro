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
   manual route is the one that can promise a named chair. */

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
  onChair: (seat: Seat, state: "connected" | "failed") => void,
): RoomEvents {
  const taken = new Map<Seat, string>();

  const admit = (peer: string): boolean => {
    if (session.seatOf(peer) !== undefined) return true;
    const free = open.find((p) => !taken.has(p));
    if (free === undefined) {
      /* Anybody holding the code can arrive, so a full table is an ordinary
         answer and not an error: the peer is turned away rather than left
         waiting for a welcome that will never come. */
      session.refuse(peer);
      return false;
    }
    taken.set(free, peer);
    session.join(peer, free);
    onChair(free, "connected");
    return true;
  };

  return {
    onPeer: (peer) => void admit(peer),
    onDrop: (peer) => {
      session.leave(peer);
      for (const [p, id] of taken) {
        if (id !== peer) continue;
        taken.delete(p);
        onChair(p, "failed");
      }
    },
    /* A message can outrun its own arrival event, so admission is checked
       here too rather than assumed. */
    onMessage: (peer, text) => {
      if (admit(peer)) session.receive(peer, text);
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
    /* Greet whoever turns up, but only while this window has no seat: a
       second hello after the first action is numbered is what the host turns
       away as late. */
    onPeer: () => {
      if (session.seat() === null) session.hello();
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
