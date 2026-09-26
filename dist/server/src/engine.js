import { credit, log } from "../../shared/utils/logger";
import { initPhysics } from "../../shared/physics/rapier";
import { GameLoop } from "./GameLoop";
import { World } from "./world/world";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "../../shared/networking/invite";
import { NetworkSystem } from "./networking/NetworkSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export const MAX_INVITE_CODE_ATTEMPTS = 100;
export class Engine extends EventEmitter {
    constructor(options) {
        super();
        this.rooms = new Map();
        this.entities = options.entities;
        this.context = (options.context ?? this);
        this.network = new NetworkSystem(options.network);
        this.loop = new GameLoop(options.loop);
        this.network.route("/rooms", () => Response.json(this.occupancy()));
        this.maxRooms = options.rooms?.maximum ?? Infinity;
    }
    async init() {
        credit("Server");
        log("Phoenix Server", "Initializing the engine...");
        await initPhysics();
        this.network.init();
        this.loop.on("tick", (deltaTime) => {
            for (const room of this.rooms.values()) {
                room.update(deltaTime);
            }
        });
        this.loop.resume();
        log("Phoenix Server", "Successfully initiated the engine");
        this.emit("init");
    }
    createRoom(maxPlayers, capacity, inviteCode = this.freeInviteCode()) {
        if (this.rooms.has(inviteCode)) {
            throw new Error(`A room with invite code "${inviteCode}" already exists`);
        }
        if (this.rooms.size === this.maxRooms) {
            throw new Error(`The engine is at its maximum of ${this.maxRooms} rooms`);
        }
        const room = new World({ inviteCode, maxPlayers, capacity, entities: this.entities, context: this.context, network: this.network });
        this.rooms.set(inviteCode, room);
        return room;
    }
    occupancy() {
        const rooms = {};
        for (const [code, room] of this.rooms) {
            rooms[code] = room.sockets.size;
        }
        return rooms;
    }
    getRoom(inviteCode) {
        return this.rooms.get(inviteCode);
    }
    destroyRoom(inviteCode) {
        const room = this.rooms.get(inviteCode);
        if (room === undefined) {
            return false;
        }
        room.destroy();
        this.rooms.delete(inviteCode);
        return true;
    }
    freeInviteCode() {
        for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
            let code = "";
            for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
                code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
            }
            if (!this.rooms.has(code)) {
                return code;
            }
        }
        throw new Error(`No free invite code after ${MAX_INVITE_CODE_ATTEMPTS} attempts: too many rooms are open`);
    }
    destroy() {
        for (const inviteCode of [...this.rooms.keys()]) {
            this.destroyRoom(inviteCode);
        }
        this.network.destroy();
        this.loop.destroy();
        this.emit("destroy");
        this.removeAllListeners();
    }
}
