import { type SessionResponse } from "../../../shared/networking/session";
export type Admission = {
    readonly sessionID: string;
    readonly reconnected: boolean;
};
export declare class SessionManager {
    private readonly tickets;
    private readonly sessions;
    issue(token: string | undefined): SessionResponse;
    redeem(ticket: string): Admission | undefined;
    ticketFrom(header: string | null): string | undefined;
    connect(sessionID: string): boolean;
    disconnect(sessionID: string): void;
    isConnected(sessionID: string): boolean;
    sweep(now?: number): void;
    clear(): void;
}
