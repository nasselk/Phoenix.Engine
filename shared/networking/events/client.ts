import { NetworkEvent } from "./event.js";

NetworkEvent.resetEncoder();

export const clientEvents = {
	ping: new NetworkEvent(0, false, 15, false), // Dont account of ping for IDLE detection since it's sent automatically
	/** Immediate echo of a server `pingProbe` seq so the SERVER can measure RTT trustlessly (mod/admin display). */
	pingProbeReply: new NetworkEvent(2, false, 15, false),
	FOV: new NetworkEvent(4, false, 50),
	/** Length cap inflated so dev accounts (role >= 3) can use long display
	 *  names. Server still enforces the standard 15-char cap for non-devs. */
	startGameSession: new NetworkEvent([2, 1024], true, 5),
	stopGameSession: new NetworkEvent(0, true, 3),
	retrieveSession: new NetworkEvent([2, 50], false, 2),
	pointerPosition: new NetworkEvent(4, true, 1000),
	startAbility1: new NetworkEvent(0, true, 25),
	stopAbility1: new NetworkEvent(0, true, 25),
	startAbility2: new NetworkEvent(0, true, 25),
	stopAbility2: new NetworkEvent(0, true, 25),
	startDiving: new NetworkEvent(0, true, 25),
	stopDiving: new NetworkEvent(0, true, 25),
	startBoost: new NetworkEvent(0, true, 25),
	stopBoost: new NetworkEvent(0, true, 25),
	startDrop: new NetworkEvent(0, true, 25),
	stopDrop: new NetworkEvent(0, true, 25),
	toggleClimbingState: new NetworkEvent(0, true, 25),
	chatMessage: new NetworkEvent([2, 142], true, 15),
	upgradeSlot: new NetworkEvent([1, 64], true, 10),
	upgrade: new NetworkEvent(0, true, 15),
	downgrade: new NetworkEvent(0, true, 15),
	arenaRequest: new NetworkEvent(2, true, 15),
	arenaResponse: new NetworkEvent(1, true, 15),
	startSpectate: new NetworkEvent(0, true, 15),
	stopSpectate: new NetworkEvent(0, true, 15),
	settings: new NetworkEvent(1, true, 3),

	/*googleAuth: new NetworkEvent(Infinity),
	appleAuth: new NetworkEvent(Infinity),
	facebookAuth: new NetworkEvent(Infinity),
	discordAuth: new NetworkEvent(Infinity),
	emailAuth: new NetworkEvent(Infinity),
	tokenAuth: new NetworkEvent(Infinity),*/

	// Admin only (for the engine) :
	camera: new NetworkEvent([1, 13], true),
	destroy: new NetworkEvent(2, true),
	move: new NetworkEvent(6, true),
	//create: new NetworkEvent(6, true), NO LISTENER

	// Moderation (role-gated server-side; handled on the networking thread, not transferred to core) :
	/** Moderator targets/observes a player to fetch info + mouse trail. Polled at ~60 Hz while a
	 *  target is locked (real-time trail), so the cap allows that for non-admin mods too. Admins
	 *  bypass rate limits entirely. */
	targetPlayer: new NetworkEvent(2, false, 75),
	/** Moderator disconnects (kicks) a targeted player (by account id). */
	modDisconnect: new NetworkEvent([0, 80], false, 5),
	/** Moderator bans a targeted player by account id (real cross-server account ban via AWP). */
	modBan: new NetworkEvent([0, 400], false, 3),
	/** Admin requests the full connected-player list. */
	adminUserList: new NetworkEvent(0, false, 3),
	/** Admin teleports relative to a targeted player (mode: 0 = self→target, 1 = target→self). */
	adminTeleport: new NetworkEvent(3, false, 10),
};
