/**
 * WebSocket subprotocol used to carry the one-time session token issued by `/session/init`.
 *
 * The client offers `[SESSION_SUBPROTOCOL, <token>]` on the upgrade; the server reads the token
 * from the second value and selects/echoes only `SESSION_SUBPROTOCOL` back so the handshake
 * completes. This keeps the negotiated protocol name stable while the credential rides alongside
 * it — and, crucially, avoids a cookie, which mobile browsers drop inside third-party iframes.
 */
export const SESSION_SUBPROTOCOL = "mope.session";
