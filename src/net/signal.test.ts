import { describe, expect, it } from "vitest";
import { codeInHash, joinLink, packSdp, unpackSdp } from "./signal";
import { NET_VERSION } from "./protocol";
import { ANSWER_SDP, LAN_OFFER_SDP, OFFER_SDP } from "./sdp.fixture";

/* What a peer actually needs out of the other's description. Everything else
   in an SDP for one data channel is the same on both sides, and is rebuilt. */
const parts = (sdp: string) => ({
  ufrag: /^a=ice-ufrag:(\S+)/m.exec(sdp)?.[1],
  pwd: /^a=ice-pwd:(\S+)/m.exec(sdp)?.[1],
  fp: /^a=fingerprint:sha-256 (\S+)/m.exec(sdp)?.[1],
  setup: /^a=setup:(\S+)/m.exec(sdp)?.[1],
  cands: [...sdp.matchAll(/^a=candidate:(\S+) (\d+) (\S+) (\d+) (\S+) (\d+) typ (\S+)/gm)].map(
    (m) => m.slice(1, 8).join(" "),
  ),
});

describe("a real browser description", () => {
  it.each([
    ["an offer", "H" as const, OFFER_SDP],
    ["an answer", "G" as const, ANSWER_SDP],
    ["a LAN-only offer", "H" as const, LAN_OFFER_SDP],
  ])("survives %s intact", (_what, kind, sdp) => {
    const out = unpackSdp(kind, packSdp(kind, sdp));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(parts(out.sdp)).toEqual(parts(sdp));
    /* Vacuity guard: a comparison of two empty descriptions would pass. */
    expect(parts(sdp).cands.length).toBeGreaterThan(1);
    expect(parts(sdp).fp).toBeTruthy();
  });

  it("rebuilds the boilerplate a data channel needs", () => {
    const out = unpackSdp("H", packSdp("H", OFFER_SDP));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    for (const l of [
      "v=0",
      "a=group:BUNDLE 0",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
      "c=IN IP4 0.0.0.0",
      "a=mid:0",
      "a=sctp-port:5000",
    ])
      expect(out.sdp).toContain(l);
    expect(out.sdp.endsWith("\r\n")).toBe(true);
  });

  it("fits in a code short enough to paste and to scan", () => {
    /* Around 430 characters as captured. The budget is what stops a change to
       the compact form from quietly doubling it. */
    expect(packSdp("H", OFFER_SDP).length).toBeLessThan(700);
    expect(packSdp("H", LAN_OFFER_SDP).length).toBeLessThan(500);
  });

  it("says which side of the exchange it is", () => {
    expect(packSdp("H", OFFER_SDP).startsWith(`T${NET_VERSION}H`)).toBe(true);
    expect(packSdp("G", ANSWER_SDP).startsWith(`T${NET_VERSION}G`)).toBe(true);
  });
});

describe("a code that is not one", () => {
  const good = packSdp("H", OFFER_SDP);

  it.each([
    ["nothing at all", "H" as const, "", "empty"],
    ["whitespace", "H" as const, "   \n ", "empty"],
    ["a sentence the player pasted", "H" as const, "here you go!", "format"],
    ["an answer in the offer box", "H" as const, packSdp("G", ANSWER_SDP), "kind"],
    ["an offer in the answer box", "G" as const, good, "kind"],
    ["another build's code", "H" as const, `T${NET_VERSION + 1}H${good.slice(3)}`, "version"],
    ["base64 that is not the payload", "H" as const, `T${NET_VERSION}Habc`, "decode"],
  ])("is refused: %s", (_what, kind, code, why) => {
    const out = unpackSdp(kind, code);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.why).toBe(why);
  });

  it("survives every prefix of a real code without throwing", () => {
    /* A half-pasted code is the ordinary accident, and it must not be an
       exception: every prefix is either refused or unpacks. */
    for (let i = 0; i <= good.length; i++)
      expect(() => unpackSdp("H", good.slice(0, i))).not.toThrow();
  });

  it("tolerates the newline a copied code arrives with", () => {
    expect(unpackSdp("H", `\n${good}\n`).ok).toBe(true);
  });
});

describe("the join link", () => {
  it("puts the code in the fragment, where a QR can carry it", () => {
    const code = packSdp("H", OFFER_SDP);
    const url = joinLink("https://example.test", "/tupatro/", code);
    expect(url).toBe(`https://example.test/tupatro/#j=${code}`);
    expect(codeInHash(new URL(url).hash)).toBe(code);
    /* base64url, so nothing in it is eaten by the fragment. */
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("reads nothing out of any other hash", () => {
    expect(codeInHash("")).toBeNull();
    expect(codeInHash("#scores")).toBeNull();
  });
});
