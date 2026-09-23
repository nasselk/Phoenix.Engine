import { World as BaseWorld } from "../../../shared/world/world";
import { GRAVITY } from "../../../shared/physics/constants";
import { RAPIER } from "../../../shared/physics/rapier";
import { Replication } from "./replication";
export const MAX_SERVER_WORLD_SIZE = 2 ** 16 - 1;
export class World extends BaseWorld {
    constructor(options) {
        super({ ...options, capacity: options.capacity ?? MAX_SERVER_WORLD_SIZE });
        this.sockets = new Set();
        this.bodies = new Set();
        if (this.capacity > MAX_SERVER_WORLD_SIZE) {
            throw new Error(`World capacity must be at most ${MAX_SERVER_WORLD_SIZE}, got ${this.capacity}`);
        }
        this.inviteCode = options.inviteCode;
        this.network = options.network;
        this.replication = new Replication(this.registry);
        this.physics = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    }
    allocateID() {
        const id = this.ids.allocate();
        if (id > MAX_SERVER_WORLD_SIZE) {
            this.ids.free(id);
            throw new Error(`World ran out of entity ids: ${this.size} alive and ${this.ids.pendingTimeouts} waiting out their reuse delay`);
        }
        return id;
    }
    update(deltaTime) {
        this.replication.reset();
        super.update(deltaTime);
    }
    simulate(deltaTime) {
        const { physics, bodies } = this;
        for (const entity of bodies) {
            if (entity.alive) {
                entity.beforePhysics();
            }
        }
        physics.timestep = deltaTime;
        physics.step();
        for (const entity of bodies) {
            if (entity.alive) {
                entity.afterPhysics();
            }
        }
    }
    frame(socket, visible) {
        if (socket.room !== this) {
            throw new Error(`Socket ${socket.id} is not in room ${this.inviteCode}`);
        }
        return this.replication.frame(socket.seen, visible);
    }
    clean() {
        for (const entity of this.entities.values()) {
            if (entity.alive && entity.isDirty) {
                entity.clean();
            }
        }
        this.replication.reset();
    }
    join(socket) {
        if (socket.room === this) {
            return this;
        }
        socket.room?.leave(socket);
        this.sockets.add(socket);
        socket.room = this;
        socket.subscribe(this.inviteCode);
        return this;
    }
    leave(socket) {
        if (!this.sockets.delete(socket)) {
            return false;
        }
        socket.seen.clear();
        socket.room = undefined;
        socket.unsubscribe(this.inviteCode);
        return true;
    }
    spawn(kind, ...args) {
        const Kind = this.registry.class(kind);
        const options = (args[0] ?? {});
        const entity = new Kind(this, this.context, options);
        return this.insert(kind, entity, options.id);
    }
    broadcast(event, ...data) {
        this.network.broadcast(this.inviteCode, event, ...data);
        return this;
    }
    destroy() {
        for (const socket of [...this.sockets]) {
            this.leave(socket);
        }
        super.destroy();
        this.replication.reset();
        this.physics.free();
    }
}
