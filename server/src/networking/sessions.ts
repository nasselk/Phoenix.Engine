import { SESSION_SUBPROTOCOL, SESSION_TTL, TICKET_TTL, type SessionResponse } from "../../../shared/networking/session";

/** What a redeemed ticket grants: the identity the socket takes, and whether it is one coming back. */
export type Admission = {
	readonly sessionID: string;
	readonly reconnected: boolean;
};

type Ticket = Admission & { readonly expiresAt: number };

/**
 * Who may open a socket, and as whom. A client asks for a ticket over HTTP, then presents it once,
 * within TICKET_TTL, to open its socket. A session outlives a dropped connection by SESSION_TTL, so a
 * client that reconnects in time gets its old session id back and the game can seat it where it was.
 *
 * A session has at most one socket: one still connected is never handed out again.
 */
export class SessionManager {
	/** Unredeemed tickets, by uuid. */
	private readonly tickets = new Map<string, Ticket>();

	/** Known session ids, valued by the epoch ms they stop being reclaimable; `Infinity` while a socket holds one. */
	private readonly sessions = new Map<string, number>();

	/** A ticket for the session `token` names when it can be reclaimed, for a new session otherwise. */
	public issue(token: string | undefined): SessionResponse {
		const now = Date.now();
		const held = token === undefined ? undefined : this.sessions.get(token);
		const reconnected = held !== undefined && held !== Infinity && now < held;
		const sessionID = reconnected ? token! : crypto.randomUUID();
		const ticket = crypto.randomUUID();

		this.tickets.set(ticket, { sessionID, reconnected, expiresAt: now + TICKET_TTL });
		this.sessions.set(sessionID, now + SESSION_TTL + TICKET_TTL);

		return { ticket, sessionID, allowReconnection: reconnected };
	}

	/**
	 * Spend a ticket. It is gone after the first look either way, so one ticket opens one socket at
	 * most. Undefined for an unknown or stale ticket, or one whose session is connected meanwhile.
	 */
	public redeem(ticket: string): Admission | undefined {
		const admission = this.tickets.get(ticket);

		if (admission === undefined) {
			return undefined;
		}

		this.tickets.delete(ticket);

		if (Date.now() >= admission.expiresAt || this.isConnected(admission.sessionID)) {
			return undefined;
		}

		return { sessionID: admission.sessionID, reconnected: admission.reconnected };
	}

	/** The ticket among the offered WebSocket subprotocols: `[SESSION_SUBPROTOCOL, <ticket>]`. */
	public ticketFrom(header: string | null): string | undefined {
		if (!header) {
			return undefined;
		}

		const offered = header.split(",").map((value) => value.trim());

		if (!offered.includes(SESSION_SUBPROTOCOL)) {
			return undefined;
		}

		return offered.find((value) => value !== SESSION_SUBPROTOCOL) || undefined;
	}

	/** A socket now holds the session. False when another one already does: the caller turns it away. */
	public connect(sessionID: string): boolean {
		if (this.isConnected(sessionID)) {
			return false;
		}

		this.sessions.set(sessionID, Infinity);

		return true;
	}

	/** Its socket closed: the session stays reclaimable for SESSION_TTL. */
	public disconnect(sessionID: string): void {
		this.sessions.set(sessionID, Date.now() + SESSION_TTL);
	}

	public isConnected(sessionID: string): boolean {
		return this.sessions.get(sessionID) === Infinity;
	}

	/** Forget expired tickets and sessions. */
	public sweep(now: number = Date.now()): void {
		for (const [ticket, { expiresAt }] of this.tickets) {
			if (now >= expiresAt) {
				this.tickets.delete(ticket);
			}
		}

		for (const [sessionID, expiresAt] of this.sessions) {
			if (now >= expiresAt) {
				this.sessions.delete(sessionID);
			}
		}
	}

	public clear(): void {
		this.tickets.clear();
		this.sessions.clear();
	}
}
