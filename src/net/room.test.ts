import { describe, expect, it } from "vitest";
import { NET_VERSION } from "./protocol";
import { ROOM_APP_ID, openRoom, roomIdFor, type Joiner } from "./room";
import { STUN } from "./rtc";

/* A relay with no network. It is deliberately only the part of Trystero that
   openRoom actually uses — makeAction, the two peer callbacks, getPeers and
   leave — so this file checks the wiring and cannot drift into testing
   Trystero itself.

   What the wiring then does to a session is seating.ts's, and is tested
   there. */

type Wire = {
  send: (data: unknown, opts?: { target?: string | null }) => Promise<void>;
  onMessage: ((data: unknown, ctx: { peerId: string }) => void) | null;
};

type Node = {
  id: string;
  roomId: string;
  gone: boolean;
  wire: Wire | null;
  onPeerJoin: ((peer: string) => void) | null;
  onPeerLeave: ((peer: string) => void) | null;
  makeAction: () => Wire;
  getPeers: () => Record<string, unknown>;
  leave: () => Promise<void>;
};

type Relay = {
  join: Joiner;
  /* Configs as they were handed to joinRoom, newest last. */
  calls: { config: Record<string, unknown>; roomId: string }[];
  /* Introduce everybody in the same room to everybody else, which is what a
     relay does once it has found them. Explicit rather than automatic:
     openRoom sets its callbacks after joinRoom has returned. */
  meet: () => void;
  nodes: Node[];
};

function relay(): Relay {
  const nodes: Node[] = [];
  const calls: { config: Record<string, unknown>; roomId: string }[] = [];
  const peersOf = (me: Node) => nodes.filter((n) => n !== me && !n.gone && n.roomId === me.roomId);
  const met = new Set<string>();

  const join = ((config: Record<string, unknown>, roomId: string) => {
    const node: Node = {
      id: `p${nodes.length + 1}`,
      roomId,
      gone: false,
      wire: null,
      onPeerJoin: null,
      onPeerLeave: null,
      makeAction: () => {
        const wire: Wire = {
          send: (data, opts) => {
            for (const other of peersOf(node)) {
              if (opts?.target && opts.target !== other.id) continue;
              other.wire?.onMessage?.(data, { peerId: node.id });
            }
            return Promise.resolve();
          },
          onMessage: null,
        };
        node.wire = wire;
        return wire;
      },
      getPeers: () => Object.fromEntries(peersOf(node).map((n) => [n.id, {}])),
      leave: () => {
        node.gone = true;
        for (const other of peersOf(node)) other.onPeerLeave?.(node.id);
        return Promise.resolve();
      },
    };
    nodes.push(node);
    calls.push({ config, roomId });
    return node;
  }) as unknown as Joiner;

  return {
    join,
    calls,
    nodes,
    meet: () => {
      for (const a of nodes)
        for (const b of nodes) {
          const pair = `${a.id}:${b.id}`;
          if (a === b || a.gone || b.gone || a.roomId !== b.roomId || met.has(pair)) continue;
          met.add(pair);
          a.onPeerJoin?.(b.id);
        }
    },
  };
}

type Heard = { peer: string; text: string };

function member(r: Relay, code: string, lan = false) {
  const peers: string[] = [];
  const gone: string[] = [];
  const heard: Heard[] = [];
  const room = openRoom(
    code,
    lan,
    {
      onPeer: (peer) => peers.push(peer),
      onDrop: (peer) => gone.push(peer),
      onMessage: (peer, text) => heard.push({ peer, text }),
    },
    r.join,
  );
  return { room, peers, gone, heard };
}

describe("a room's id", () => {
  it("carries the protocol version, so two versions cannot meet at all", () => {
    expect(roomIdFor("ABCD1234")).toBe(`${ROOM_APP_ID}-v${NET_VERSION}-ABCD1234`);
  });

  it("is the same room however the code was typed", () => {
    expect(roomIdFor("  abcd1234 ")).toBe(roomIdFor("ABCD1234"));
  });
});

describe("a room", () => {
  it("is named and locked by the same code", () => {
    const r = relay();
    member(r, "ABCD1234");

    expect(r.calls[0].roomId).toBe(roomIdFor("ABCD1234"));
    expect(r.calls[0].config).toMatchObject({ appId: ROOM_APP_ID, password: "ABCD1234" });
  });

  it("omits STUN on LAN only, and asks for it otherwise", () => {
    const r = relay();
    member(r, "ABCD1234", true);
    member(r, "ABCD1234", false);

    expect(r.calls[0].config.rtcConfig).toEqual({});
    expect(r.calls[1].config.rtcConfig).toEqual({ iceServers: STUN });
  });

  it("reports each arrival once the relay has introduced them", () => {
    const r = relay();
    const a = member(r, "ABCD1234");
    const b = member(r, "ABCD1234");
    r.meet();

    expect(a.peers).toEqual([r.nodes[1].id]);
    expect(b.peers).toEqual([r.nodes[0].id]);
    expect(a.room.peers()).toEqual([r.nodes[1].id]);
  });

  it("keeps two codes apart", () => {
    const r = relay();
    const a = member(r, "ABCD1234");
    const b = member(r, "ZZZZ9999");
    r.meet();

    expect(a.peers).toEqual([]);
    expect(a.room.peers()).toEqual([]);
    expect(b.peers).toEqual([]);
  });

  it("sends to the peer it was aimed at, and to nobody else", () => {
    const r = relay();
    const a = member(r, "ABCD1234");
    const b = member(r, "ABCD1234");
    const c = member(r, "ABCD1234");
    r.meet();

    a.room.send(r.nodes[1].id, "for b");

    expect(b.heard).toEqual([{ peer: r.nodes[0].id, text: "for b" }]);
    expect(c.heard).toEqual([]);
  });

  it("tells the others when a peer closes its room", () => {
    const r = relay();
    const a = member(r, "ABCD1234");
    const b = member(r, "ABCD1234");
    r.meet();

    b.room.close();

    expect(a.gone).toEqual([r.nodes[1].id]);
    expect(a.room.peers()).toEqual([]);
  });
});
