import { World } from "./world/world";
export class GameRoom extends World {
    constructor(id, inviteCode, options = {}) {
        super(options);
        this.id = id;
        this.inviteCode = inviteCode;
        this.players = new Set();
    }
    addPlayer(player) {
        this.players.add(player);
    }
    removePlayer(player) {
        this.players.delete(player);
    }
    dispose() {
        this.players.clear();
        super.dispose();
    }
}
