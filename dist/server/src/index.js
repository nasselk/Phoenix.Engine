import { IDAllocator } from "../../shared/utils/IDAllocator";
import { credit, log } from "../../shared/utils/logger";
import { GameLoop } from "./GameLoop";
import { World } from "./world/world";
import { randomUUID } from "crypto";
import { NetworkSystem } from "./networking/NetworkSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export * from "../../shared/index";
export { Entity } from "./world/entity";
export { MovingEntity, MIN_SPEED as STOP_SPEED } from "./world/moving";
export { BoxCollider, Collider, collide, collideBoxBox, collideBoxPlane, DEFAULT_MASS, inverseMass, MIN_SLIDE, PlaneCollider, RESTITUTION_THRESHOLD, resolve, SLOP } from "./world/collision/index";
export { POSITION_EPSILON, PositionEntity, ROTATION_EPSILON } from "./world/position";
export { World } from "./world/world";
export { GameLoop } from "./GameLoop";
export { DEFAULT_NETWORK_SETTINGS, NetworkSystem } from "./networking/NetworkSystem";
export { Socket } from "./networking/socket";
export { setExitListeners } from "./utils/utils";
export const DEFAULT_ROOM_CAPACITY = 5000;
export class Engine extends EventEmitter {
    constructor(options = {}) {
        super();
        const capacity = options.capacity ?? DEFAULT_ROOM_CAPACITY;
        this.capacity = capacity;
        this.entities = options.entities;
        this.context = (options.context ?? this);
        this.network = new NetworkSystem(options.network);
        this.loop = new GameLoop(options.loop);
        this.rooms = new Map();
        this.roomIDs = new IDAllocator();
        this.roomsByInviteCode = new Map();
    }
    createRoom(inviteCode = randomUUID()) {
        if (this.roomsByInviteCode.has(inviteCode)) {
            throw new Error(`A room with invite code "${inviteCode}" already exists`);
        }
        const room = new World({ id: this.roomIDs.allocate(), inviteCode, capacity: this.capacity, entities: this.entities, context: this.context });
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
