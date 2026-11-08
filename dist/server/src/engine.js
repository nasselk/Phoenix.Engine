import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "../../shared/networking/invite";
import { initPhysics } from "../../shared/physics/rapier";
import { EventEmitter } from "../../shared/utils/EventEmitter";
import { credit, log } from "../../shared/utils/logger";
import { GameLoop } from "./GameLoop";
import { NetworkSystem } from "./networking/NetworkSystem";
import { World } from "./world/world";
export const MAX_INVITE_CODE_ATTEMPTS = 100;
const RANDOM_BYTES = new Uint8Array(INVITE_CODE_LENGTH);
const UNBIASED_BYTES = 256 - (256 % INVITE_CODE_ALPHABET.length);
export class Engine extends EventEmitter {
    constructor(options) {
        super();
        this.rooms = new Map();
        this.entities = options.entities;
        this.context = (options.context ?? this);
        this.network = new NetworkSystem(options.network);
        this.loop = new GameLoop(options.loop);
        this.network.route("/rooms/:code", (request) => {
            const room = this.getRoom(request.params.code ?? "");
            return room === undefined ? new Response(null, { status: 404 }) : Response.json(this.occupancyOf(room));
        });
        this.maxRooms = options.rooms?.maximum ?? Infinity;
    }
    async init() {
        credit("Server");
        log("Phoenix Server", "Initializing the engine...");
        await initPhysics();
        this.network.init();
        this.loop.on("tick", (deltaTime) => {
            for (const room of this.rooms.values()) {
                if (room.destroyed) {
                    this.rooms.delete(room.inviteCode);
                }
                else {
                    room.update(deltaTime);
                }
            }
        });
        this.loop.resume();
        log("Phoenix Server", "Successfully initiated the engine");
        this.emit("init");
    }
    createRoom({ maxPlayers, capacity, public: isPublic = true, inviteCode = this.generateInviteCode(), seed } = {}) {
        if (this.rooms.has(inviteCode)) {
            throw new Error(`A room with invite code "${inviteCode}" already exists`);
        }
        if (this.rooms.size === this.maxRooms) {
            throw new Error(`The engine is at its maximum of ${this.maxRooms} rooms`);
        }
        const room = new World({ inviteCode, maxPlayers, capacity, public: isPublic, seed, entities: this.entities, context: this.context, network: this.network });
        this.rooms.set(inviteCode, room);
        return room;
    }
    occupancy() {
        const rooms = {};
        for (const [code, room] of this.rooms) {
            if (!room.destroyed) {
                rooms[code] = this.occupancyOf(room);
            }
        }
        return rooms;
    }
    occupancyOf(room) {
        return { players: room.sockets.size, maxPlayers: room.maxPlayers, public: room.public };
    }
    fullestRoom(...exclude) {
        let fullest;
        for (const room of this.rooms.values()) {
            if (!room.destroyed && room.public && !exclude.includes(room.inviteCode) && room.sockets.size < room.maxPlayers && (fullest === undefined || room.sockets.size > fullest.sockets.size)) {
                fullest = room;
            }
        }
        return fullest;
    }
    getRoom(inviteCode) {
        const room = this.rooms.get(inviteCode);
        return room?.destroyed ? undefined : room;
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
    generateInviteCode(maxAttempts = MAX_INVITE_CODE_ATTEMPTS) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let code = "";
            while (code.length < INVITE_CODE_LENGTH) {
                crypto.getRandomValues(RANDOM_BYTES);
                for (let i = 0; i < RANDOM_BYTES.length && code.length < INVITE_CODE_LENGTH; i++) {
                    if (RANDOM_BYTES[i] < UNBIASED_BYTES) {
                        code += INVITE_CODE_ALPHABET[RANDOM_BYTES[i] % INVITE_CODE_ALPHABET.length];
                    }
                }
            }
            if (!this.rooms.has(code)) {
                return code;
            }
        }
        throw new Error(`No free invite code after ${maxAttempts} attempts: too many rooms are open`);
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
//# sourceMappingURL=engine.js.map