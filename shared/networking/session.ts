/**
 * WebSocket subprotocol used to carry the one-time session token issued by `/session/init`.
 *
 * The client offers `[SESSION_SUBPROTOCOL, <token>]` on the upgrade; the server reads the token
 * from the second value and selects/echoes only `SESSION_SUBPROTOCOL` back so the handshake
 * completes. This keeps the negotiated protocol name stable while the credential rides alongside
 * it — and, crucially, avoids a cookie, which mobile browsers drop inside third-party iframes.
 */
export const SESSION_SUBPROTOCOL = "mope.session";

/** HTTP route that mints a session ticket. POST, JSON in, JSON out. */
export const SESSION_ROUTE = "/session/init";

/** WebSocket route the ticket is redeemed against. */
export const WS_ROUTE = "/ws";

/** How long a ticket stays redeemable: long enough to open a socket, short enough to be worthless if it leaks. */
export const TICKET_TTL = 5_000;

/** How long a disconnected session id stays claimable by a client presenting it as `reconnectionToken`. */
export const SESSION_TTL = 30_000;

/** Body of a POST to {@link SESSION_ROUTE}. Anything else a game sends rides alongside these. */
export type SessionRequest = {
	/** The session id from a previous handshake, to keep the same identity across a reconnect. */
	reconnectionToken?: string | null;
	[key: string]: unknown;
};

/** Answer to a POST to {@link SESSION_ROUTE}. */
export type SessionResponse = {
	/** One-time credential for the upgrade. Offered as the second subprotocol, never logged. */
	ticket: string;
	/** Stable identity for this session; present it as `reconnectionToken` next time. */
	sessionID: string;
	/** Whether the `reconnectionToken` sent along was still known, so this session continues the old one. */
	allowReconnection: boolean;
};
