import { packSdp, unpackSdp, type SdpKind, type Unpacked } from "./signal";

/* ============================ the one WebRTC door ============================
   Every RTCPeerConnection in the project is created here, the way every
   localStorage access is made in game/storage.ts. Above this line the
   transport is a `send` and a stream of strings, which is why the relay and
   the protocol can be tested with no browser at all.

   Two decisions worth knowing:

   - **No timer.** useGameLoop is the only setTimeout call site in the project
     and this does not become the second. ICE gathering is awaited through its
     own event; where it never completes — a blocked STUN server, a network
     that answers nothing — the lobby offers the code built from the
     candidates gathered so far rather than a deadline nobody chose. `code()`
     may be called at any moment for exactly that reason.
   - **STUN is a third party and is optional.** Two browsers cannot introduce
     themselves, and across NATs they cannot even find each other without one.
     `lan` omits it, which keeps "no backend" literally true on one network —
     and keeps the invitation free of the player's public address. */
export const STUN: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export type LinkEvents = {
  onOpen: () => void;
  onMessage: (text: string) => void;
  onClose: () => void;
  /* How the invitation is coming along: how many candidates so far, and
     whether the browser considers itself finished. */
  onProgress: (candidates: number, complete: boolean) => void;
};

export type Link = {
  id: string;
  /* The invitation as it stands. Complete once `gathered` has resolved; before
     that it is whatever the browser has found, which on one network is
     already enough. */
  code: () => string;
  gathered: Promise<void>;
  /* The host's side of the exchange: the answer the guest pasted back. */
  take: (code: string) => Promise<Unpacked>;
  send: (text: string) => void;
  close: () => void;
};

const config = (lan: boolean): RTCConfiguration => (lan ? {} : { iceServers: STUN });

type Wired = { base: Omit<Link, "take">; attach: (ch: RTCDataChannel) => void };

function wire(pc: RTCPeerConnection, kind: SdpKind, ev: LinkEvents): Wired {
  const id = crypto.randomUUID();
  const state = { channel: null as RTCDataChannel | null, seen: 0 };

  const gathered = new Promise<void>((done) => {
    if (pc.iceGatheringState === "complete") return done();
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") done();
    });
  });
  pc.addEventListener("icecandidate", (e) => {
    if (e.candidate) state.seen++;
    ev.onProgress(state.seen, pc.iceGatheringState === "complete");
  });
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") ev.onClose();
  });

  const attach = (ch: RTCDataChannel) => {
    state.channel = ch;
    ch.addEventListener("open", ev.onOpen);
    ch.addEventListener("close", ev.onClose);
    ch.addEventListener("message", (e: MessageEvent) => {
      if (typeof e.data === "string") ev.onMessage(e.data);
    });
  };

  return {
    attach,
    base: {
      id,
      gathered,
      code: () => packSdp(kind, pc.localDescription?.sdp ?? ""),
      send: (text) => {
        if (state.channel?.readyState === "open") state.channel.send(text);
      },
      close: () => {
        state.channel?.close();
        pc.close();
      },
    },
  };
}

/* The host's half: one connection per open chair, each with its own
   invitation. The channel is created here, so the guest receives it. */
export async function hostLink(lan: boolean, ev: LinkEvents): Promise<Link> {
  const pc = new RTCPeerConnection(config(lan));
  const { base, attach } = wire(pc, "H", ev);
  attach(pc.createDataChannel("tupatro", { ordered: true }));
  await pc.setLocalDescription(await pc.createOffer());
  return {
    ...base,
    take: async (code) => {
      const answer = unpackSdp("G", code);
      if (!answer.ok) return answer;
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      return answer;
    },
  };
}

/* The guest's half: the host's invitation in, an answer out. */
export async function guestLink(
  lan: boolean,
  offerCode: string,
  ev: LinkEvents,
): Promise<Link | Extract<Unpacked, { ok: false }>> {
  const offer = unpackSdp("H", offerCode);
  if (!offer.ok) return offer;
  const pc = new RTCPeerConnection(config(lan));
  const { base, attach } = wire(pc, "G", ev);
  pc.addEventListener("datachannel", (e) => attach(e.channel));
  await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  return {
    ...base,
    /* A guest has nothing left to take: the exchange ends with its answer. */
    take: async () => ({ ok: true, sdp: "" }),
  };
}
