import { IDAllocator } from "../../shared/utils/IDAllocator";
import { credit, log } from "../../shared/utils/logger";
import { MAX_ENTITIES } from "../../shared/world/world";
import { GameLoop } from "./GameLoop";
import { GameRoom } from "./room";
import { randomUUID } from "crypto";
import { NetworkSystem } from "./networking/NetworkSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export * from "../../shared/index";
export { Entity } from "./world/entity";
export { MovingEntity } from "./world/moving";
export { POSITION_EPSILON, PositionEntity } from "./world/position";
export { ROTATION_EPSILON, RotationEntity } from "./world/rotation";
export { World } from "./world/world";
export { GameLoop } from "./GameLoop";
export { GameRoom } from "./room";
export { DEFAULT_NETWORK_SETTINGS, NetworkSystem } from "./networking/NetworkSystem";
export { Socket } from "./networking/socket";
export { setExitListeners } from "./utils/utils";
export const DEFAULT_ROOM_CAPACITY = 5000;
export class Engine extends EventEmitter {
    constructor(options = {}) {
        super();
        const capacity = options.capacity ?? DEFAULT_ROOM_CAPACITY;
        if (capacity < 1 || capacity > MAX_ENTITIES) {
            throw new Error(`Room capacity must be between 1 and ${MAX_ENTITIES}, got ${capacity}`);
        }
        this.capacity = capacity;
        this.entities = options.entities;
        this.network = new NetworkSystem(options.network);
        this.loop = new GameLoop();
        this.rooms = new Map();
        this.roomIDs = new IDAllocator();
        this.roomsByInviteCode = new Map();
    }
    createRoom(inviteCode = randomUUID()) {
        if (this.roomsByInviteCode.has(inviteCode)) {
            throw new Error(`A room with invite code "${inviteCode}" already exists`);
        }
        const room = new GameRoom(this.roomIDs.allocate(), inviteCode, { capacity: this.capacity, entities: this.entities });
        this.rooms.set(room.id, room);
        this.roomsByInviteCode.set(inviteCode, room);
        return room;
    }
    getRoom(id) {
        return this.rooms.get(id);
    }
    getRoomByInviteCode(inviteCode) {
        return this.roomsByInviteCode.get(inviteCode);
    }
    destroyRoom(id) {
        const room = this.rooms.get(id);
        if (room === undefined) {
            return false;
        }
        room.dispose();
        this.rooms.delete(id);
        this.roomsByInviteCode.delete(room.inviteCode);
        this.roomIDs.free(id);
        return true;
    }
    async init() {
        credit("Server");
        log("Phoenix Server", "Initializing the engine...");
        this.loop.on("tick", (deltaTime) => {
            for (const room of this.rooms.values()) {
                room.update(deltaTime);
            }
        });
        this.loop.resume();
        log("Phoenix Server", "Successfully initiated the engine");
        this.emit("init");
    }
    destroy() {
        for (const id of [...this.rooms.keys()]) {
            this.destroyRoom(id);
        }
        this.network.destroy();
        this.loop.destroy();
        this.emit("destroy");
        this.removeAllListeners();
    }
}
