import { NetworkEvent } from "./event.js";

NetworkEvent.resetEncoder();

// Dont mind abt bytelength for server events since clients dont need to validate it
// (if you dont trust in your own server, then uh that's a bad sign)
export const serverEvents = {
	pong: new NetworkEvent(),
	init: new NetworkEvent(),
	update: new NetworkEvent(),
	info: new NetworkEvent(),
	startGameSession: new NetworkEvent(),
	stopGameSession: new NetworkEvent(),
	upgradeMenu: new NetworkEvent(),
	serverMessage: new NetworkEvent(),
	banNotice: new NetworkEvent(),
	pingProbe: new NetworkEvent(),
	try: new NetworkEvent(),
	/** Moderation: info + mouse trail for a targeted player. */
	targetInfo: new NetworkEvent(),
	/** Admin: full connected-player list (parallel arrays). */
	adminUserList: new NetworkEvent(),
};
