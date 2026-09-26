/** What the server's default invite codes are made of. No 0/O or 1/I: a code gets read aloud and typed from a screenshot. */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_LENGTH = 6;

/** One room as a server's `GET /rooms` reports it, under its invite code. */
export type RoomOccupancy = {
	readonly players: number;
	readonly maxPlayers: number;
};
