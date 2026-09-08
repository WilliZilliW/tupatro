import { joinRoom as trysteroJoin, selfId } from "trystero";
import { NET_VERSION } from "./protocol";
import { STUN } from "./rtc";
import type { RoomEvents } from "./seating";

/* ============================ the room ============================
   The second way two browsers meet, and the one a player will actually use:
   the host reads out eight characters and everybody types them. Trystero
   carries the offers and answers over public Nostr relays, so nobody pastes
   430 characters and nobody carries an answer back.

   This file is to `trystero` what rtc.ts is to raw WebRTC: the one door.
   (Spelling the connection's own class name here would trip the invariant
   that keeps rtc.ts the only file that opens one, which is the point.)
   Above it a room is a peer id, a `send` and a stream of strings —
   exactly the shape session.ts already wants — which is why the relay, the
   sequencer and the hash comparison do not change at all for this.

   Three decisions worth knowing:

   - **The code is the room's name *and* its password.** Anyone holding it can
     take an open chair either way, so the password buys nothing against a
     player; what it buys is a relay operator that carries session
     descriptions it cannot read.
   - **NET_VERSION is in the room id.** Two peers on different protocol
     versions cannot meet in the same room at all, rather than meeting and
     being turned away by `hello` a moment later.
   - **No timer.** useGameLoop stays the only setTimeout call site. Trystero
     has its own timers inside it; this file adds none, and a peer that never
     arrives is a chair the game plays rather than a deadline nobody chose. */

export const ROOM_APP_ID = "tupatro";

/* Trystero's own joinRoom. Taking it as a parameter is what lets room.test.ts
   check this wiring against a relay with no network in it; what the wiring
   then *does* to a session is seating.ts's, and is tested there. */
export type Joiner = typeof trysteroJoin;

export const roomIdFor = (code: string): string =>
  `${ROOM_APP_ID}-v${NET_VERSION}-${code.trim().toUpperCase()}`;

export type Room = {
  code: string;
  /* This window's peer id, the same one every other peer in the room sees. */
  self: string;
  send: (peer: string, text: string) => void;
  peers: () => string[];
  close: () => void;
};

export function openRoom(
  code: string,
  lan: boolean,
  ev: RoomEvents,
  join: Joiner = trysteroJoin,
): Room {
  const room = join(
    {
      appId: ROOM_APP_ID,
      password: code,
      /* LAN only means less here than it does in the manual invitation: the
         signalling always crosses a public relay, so the switch omits STUN
         and nothing more. The lobby says so. */
      rtcConfig: lan ? {} : { iceServers: STUN },
    },
    roomIdFor(code),
  );

  const wire = room.makeAction<string>("msg");
  wire.onMessage = (text, { peerId }) => {
    if (typeof text === "string") ev.onMessage(peerId, text);
  };
  room.onPeerJoin = (peer) => ev.onPeer(peer);
  room.onPeerLeave = (peer) => ev.onDrop(peer);

  return {
    code,
    self: selfId,
    send: (peer, text) => {
      /* A send that fails is not itself evidence the peer is gone —
         onPeerLeave is the authority on that, and it is already wired. */
      void wire.send(text, { target: peer }).catch(() => {});
    },
    peers: () => Object.keys(room.getPeers()),
    close: () => {
      void room.leave();
    },
  };
}
