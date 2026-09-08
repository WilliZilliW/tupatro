/* Two real Chrome descriptions for one data channel, captured with the
   default STUN server and then anonymised: the public address is TEST-NET-3
   (203.0.113.0/24, reserved for documentation) and the mDNS host names are
   made up. Everything about the *shape* — the attribute order, the three
   candidate types, the `.local` obfuscation Chrome applies to host addresses,
   the trailing `generation 0 network-cost 999` — is exactly as the browser
   wrote it.

   They are here so the compact codec is tested against what a browser
   actually produces rather than against what this project imagines it
   produces. */

export const OFFER_SDP = [
  "v=0",
  "o=- 6202723302597145489 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 49533 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 203.0.113.7",
  "a=candidate:300009683 1 udp 2113937151 6f1d2c8a-0000-4000-8000-aaaaaaaaaaaa.local 49533 typ host generation 0 network-cost 999",
  "a=candidate:288027840 1 udp 2113942271 6f1d2c8a-0000-4000-8000-bbbbbbbbbbbb.local 50307 typ host generation 0 network-cost 999",
  "a=candidate:257810475 1 udp 1677729535 203.0.113.7 49533 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999",
  "a=ice-ufrag:u9UE",
  "a=ice-pwd:aGTDEV3M1reUAZ5TQ+t8ooya",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 B7:A6:DE:AC:88:08:03:31:B9:7B:F8:C1:EA:9D:23:F8:C1:D2:8B:5C:1A:67:46:62:CD:A6:DB:A9:E9:E8:1A:85",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "",
].join("\r\n");

export const ANSWER_SDP = [
  "v=0",
  "o=- 6450003306743341822 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 63189 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 203.0.113.7",
  "a=candidate:3650363043 1 udp 2113937151 6f1d2c8a-0000-4000-8000-aaaaaaaaaaaa.local 63189 typ host generation 0 network-cost 999",
  "a=candidate:313003427 1 udp 2113942271 6f1d2c8a-0000-4000-8000-bbbbbbbbbbbb.local 55710 typ host generation 0 network-cost 999",
  "a=candidate:1682869809 1 udp 1677729535 203.0.113.7 63189 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999",
  "a=ice-ufrag:QfUk",
  "a=ice-pwd:5w4BoXWiuTVFpLQL6EA3iaWr",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 42:79:47:DB:B4:7A:E3:B5:7A:69:68:5F:1B:9C:C5:45:2C:78:17:F7:86:83:DF:DB:F0:0C:8D:CE:0E:B0:E1:C7",
  "a=setup:active",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "",
].join("\r\n");

/* A LAN-only offer: no STUN server, so Chrome gathers nothing but its two
   mDNS host candidates and the media port stays the discard port. This is the
   shape the "LAN only" switch produces, and the one the rebuilt SDP imitates. */
export const LAN_OFFER_SDP = [
  "v=0",
  "o=- 7201281848660975018 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:1942635583 1 udp 2113937151 6f1d2c8a-0000-4000-8000-aaaaaaaaaaaa.local 58920 typ host generation 0 network-cost 999",
  "a=candidate:1929476140 1 udp 2113942271 6f1d2c8a-0000-4000-8000-bbbbbbbbbbbb.local 51681 typ host generation 0 network-cost 999",
  "a=ice-ufrag:OqTv",
  "a=ice-pwd:ZAYw7WS0VVFT3eSG7gYX72Jj",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 E5:5E:71:EA:83:BA:E9:FB:D5:AE:45:D5:39:58:1F:75:4A:92:ED:19:EB:BD:FF:98:1E:8A:14:E5:7F:09:51:5F",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "",
].join("\r\n");
