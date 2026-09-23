export declare const SESSION_SUBPROTOCOL = "mope.session";
export declare const enum ServerRoutes {
    SESSION = "/session/init",
    WS = "/ws"
}
export declare const TICKET_TTL = 5000;
export declare const SESSION_TTL = 30000;
export type SessionRequest = {
    reconnectionToken?: string | null;
    [key: string]: unknown;
};
export type SessionResponse = {
    ticket: string;
    sessionID: string;
    allowReconnection: boolean;
};
