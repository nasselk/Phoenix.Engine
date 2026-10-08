import { SESSION_SUBPROTOCOL, SESSION_TTL, TICKET_TTL } from "../../../shared/networking/session";
export class SessionManager {
    constructor() {
        this.tickets = new Map();
        this.sessions = new Map();
    }
    issue(token) {
        const now = Date.now();
        const held = token === undefined ? undefined : this.sessions.get(token);
        const reconnected = held !== undefined && held !== Infinity && now < held;
        const sessionID = reconnected ? token : crypto.randomUUID();
        const ticket = crypto.randomUUID();
        this.tickets.set(ticket, { sessionID, reconnected, expiresAt: now + TICKET_TTL });
        this.sessions.set(sessionID, now + SESSION_TTL + TICKET_TTL);
        return { ticket, sessionID, allowReconnection: reconnected };
    }
    redeem(ticket) {
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
    ticketFrom(header) {
        if (!header) {
            return undefined;
        }
        const offered = header.split(",").map((value) => value.trim());
        if (!offered.includes(SESSION_SUBPROTOCOL)) {
            return undefined;
        }
        return offered.find((value) => value !== SESSION_SUBPROTOCOL) || undefined;
    }
    connect(sessionID) {
        if (this.isConnected(sessionID)) {
            return false;
        }
        this.sessions.set(sessionID, Infinity);
        return true;
    }
    disconnect(sessionID) {
        this.sessions.set(sessionID, Date.now() + SESSION_TTL);
    }
    isConnected(sessionID) {
        return this.sessions.get(sessionID) === Infinity;
    }
    sweep(now = Date.now()) {
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
    clear() {
        this.tickets.clear();
        this.sessions.clear();
    }
}
