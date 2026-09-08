import { NET_VERSION } from "./protocol";

/* ============================ the invitation ============================
   WebRTC cannot introduce two browsers by itself: somebody has to carry the
   first two messages. Here that somebody is the players — a clipboard, a chat
   window, or a QR code held up to a camera — so the message has to be short
   enough to paste and small enough to scan.

   A browser's offer is around 850 characters of which almost all is
   boilerplate: one data channel, one media section, the same eight attributes
   every time. What actually differs between two peers is the ICE ufrag, the
   ICE password, the DTLS fingerprint, the setup role and the candidates. Those
   are kept; the rest is rebuilt on the other side. */

export type SdpKind = "H" | "G";

/* Why a code was refused. The lobby says something different for the two a
   player will actually hit — an answer pasted into the offer box, and a peer
   on an older build — so the reason is data rather than a null. */
export type Unpacked =
  | { ok: true; sdp: string }
  | { ok: false; why: "empty" | "format" | "version" | "kind" | "decode" };

type Candidate = {
  foundation: string;
  component: string;
  proto: string;
  priority: string;
  ip: string;
  port: string;
  type: string;
};

type Compact = {
  ufrag: string;
  pwd: string;
  /* sha-256, colons stripped and lower-cased: 64 characters instead of 95. */
  fp: string;
  setup: string;
  cands: Candidate[];
};

const line = (sdp: string, re: RegExp): string => re.exec(sdp)?.[1] ?? "";

/* a=candidate:<foundation> <component> <proto> <priority> <ip> <port> typ <type> …
   Everything after the type — raddr, rport, generation, network-cost — is
   informational and is dropped. */
const CAND = /^a=candidate:(\S+) (\d+) (\S+) (\d+) (\S+) (\d+) typ (\S+)/;

function compact(sdp: string): Compact {
  const cands: Candidate[] = [];
  for (const l of sdp.split(/\r\n|\n/)) {
    const m = CAND.exec(l);
    if (!m) continue;
    cands.push({
      foundation: m[1],
      component: m[2],
      proto: m[3],
      priority: m[4],
      ip: m[5],
      port: m[6],
      type: m[7],
    });
  }
  return {
    ufrag: line(sdp, /^a=ice-ufrag:(\S+)/m),
    pwd: line(sdp, /^a=ice-pwd:(\S+)/m),
    fp: line(sdp, /^a=fingerprint:sha-256 (\S+)/m)
      .replace(/:/g, "")
      .toLowerCase(),
    setup: line(sdp, /^a=setup:(\S+)/m) || "actpass",
    cands,
  };
}

/* Field separators chosen against what the parts can contain: an IPv6
   candidate is full of colons, a base64 password can hold + and /, and a
   BUNDLE of one has no commas anywhere. */
const encode = (c: Compact): string =>
  [
    c.ufrag,
    c.pwd,
    c.fp,
    c.setup,
    c.cands
      .map((k) => [k.foundation, k.component, k.proto, k.priority, k.ip, k.port, k.type].join(","))
      .join("~"),
  ].join("|");

function decode(text: string): Compact | null {
  const parts = text.split("|");
  if (parts.length !== 5) return null;
  const [ufrag, pwd, fp, setup, rest] = parts;
  if (!ufrag || !pwd || !/^[0-9a-f]{64}$/.test(fp)) return null;
  const cands: Candidate[] = [];
  for (const one of rest ? rest.split("~") : []) {
    const f = one.split(",");
    if (f.length !== 7) return null;
    cands.push({
      foundation: f[0],
      component: f[1],
      proto: f[2],
      priority: f[3],
      ip: f[4],
      port: f[5],
      type: f[6],
    });
  }
  return { ufrag, pwd, fp, setup, cands };
}

/* The boilerplate, rebuilt. The media port is 9 (discard) and the connection
   line 0.0.0.0, which is what an offer with its candidates in separate
   attributes is supposed to say; the candidates below carry the addresses. */
function expand(c: Compact): string {
  const fp = (c.fp.match(/../g) ?? []).join(":").toUpperCase();
  return (
    [
      "v=0",
      "o=- 1 2 IN IP4 127.0.0.1",
      "s=-",
      "t=0 0",
      "a=group:BUNDLE 0",
      "a=extmap-allow-mixed",
      "a=msid-semantic: WMS",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
      "c=IN IP4 0.0.0.0",
      `a=ice-ufrag:${c.ufrag}`,
      `a=ice-pwd:${c.pwd}`,
      "a=ice-options:trickle",
      `a=fingerprint:sha-256 ${fp}`,
      `a=setup:${c.setup}`,
      "a=mid:0",
      "a=sctp-port:5000",
      "a=max-message-size:262144",
      ...c.cands.map(
        (k) =>
          `a=candidate:${k.foundation} ${k.component} ${k.proto} ${k.priority} ${k.ip} ${k.port} typ ${k.type} generation 0`,
      ),
    ].join("\r\n") + "\r\n"
  );
}

/* base64url, because the code travels in a URL fragment behind a QR: a
   password can contain + and /, and both are eaten there. */
const b64url = (s: string): string =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function unb64url(s: string): string | null {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

export const packSdp = (kind: SdpKind, sdp: string): string =>
  `T${NET_VERSION}${kind}${b64url(encode(compact(sdp)))}`;

export function unpackSdp(kind: SdpKind, code: string): Unpacked {
  const text = code.trim();
  if (!text) return { ok: false, why: "empty" };
  const m = /^T(\d+)([HG])([A-Za-z0-9_-]+)$/.exec(text);
  if (!m) return { ok: false, why: "format" };
  if (Number(m[1]) !== NET_VERSION) return { ok: false, why: "version" };
  if (m[2] !== kind) return { ok: false, why: "kind" };
  const raw = unb64url(m[3]);
  if (raw === null) return { ok: false, why: "decode" };
  const c = decode(raw);
  if (!c) return { ok: false, why: "decode" };
  return { ok: true, sdp: expand(c) };
}

/* What the QR carries: the page itself, with the code in the fragment, so a
   phone's own camera app opens the game with the invitation already in the
   box and nobody types 300 characters. */
export const joinLink = (origin: string, path: string, code: string): string =>
  `${origin}${path}#j=${code}`;

/* The other end of that link. Whether what follows is a code at all is
   unpackSdp's question, not this one's. */
export const codeInHash = (hash: string): string | null =>
  hash.startsWith("#j=") ? hash.slice(3) : null;
