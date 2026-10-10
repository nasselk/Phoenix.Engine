import { World as BaseWorld } from "../../../shared/world/world";
import { GRAVITY } from "../../../shared/physics/constants";
import { RAPIER } from "../../../shared/physics/rapier";
import { Replication } from "./replication";
import { RNG } from "../../../shared/math/random";
export const MAX_SERVER_WORLD_SIZE = 2 ** 16 - 1;
export class World extends BaseWorld {
    constructor(options) {
        super({ ...options, capacity: options.capacity ?? MAX_SERVER_WORLD_SIZE });
        this.sockets = new Set();
        this.bodies = new Set();
        this.destroyed = false;
        this.ticking = false;
        this.maxPlayers = options.maxPlayers ?? this.capacity;
        if (this.capacity > MAX_SERVER_WORLD_SIZE) {
            throw new Error(`World capacity must be at most ${MAX_SERVER_WORLD_SIZE}, got ${this.capacity}`);
        }
        if (this.maxPlayers > this.capacity) {
            throw new Error(`World maxPlayers must be at most its capacity of ${this.capacity}, got ${this.maxPlayers}`);
        }
        this.inviteCode = options.inviteCode;
        this.public = options.public ?? true;
        this.network = options.network;
        this.replication = new Replication(this.registry);
        this.physics = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
        this.events = new RAPIER.EventQueue(true);
        this.RNG = new RNG(Math.floor(Math.random() * 2 ** 32));
    }
    allocateID() {
        const id = this.ids.allocate();
        if (id > MAX_SERVER_WORLD_SIZE) {
            this.ids.free(id);
            throw new Error(`World ran out of entity ids: ${this.size} alive and ${this.ids.pendingTimeouts} waiting out their reuse delay`);
        }
        return id;
    }
    join(socket) {
        if (socket.room === this) {
            return false;
        }
        if (this.sockets.size === this.maxPlayers) {
            return false;
        }
        socket.room?.leave(socket);
        this.sockets.add(socket);
        socket.room = this;
        socket.subscribe(this.inviteCode);
        return true;
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
        if (this.size >= this.capacity) {
            throw new Error(`World is full (capacity ${this.capacity})`);
        }
        const entity = new Kind(this, this.context, options);
        try {
            return this.insert(kind, entity, options.id);
        }
        catch (error) {
            entity.onDestroy();
            throw error;
        }
    }
    update(deltaTime) {
        if (this.destroyed) {
            return;
        }
        this.replication.reset();
        this.ticking = true;
        try {
            super.update(deltaTime);
        }
        finally {
            this.ticking = false;
            if (this.destroyed) {
                this.freePhysics();
            }
        }
    }
    simulate(deltaTime) {
        const { physics, bodies } = this;
        if (this.destroyed) {
            return;
        }
        for (const entity of bodies) {
            if (entity.alive) {
                entity.beforePhysics();
            }
        }
        physics.timestep = deltaTime;
        physics.step(this.events);
        for (const entity of bodies) {
            if (entity.alive) {
                entity.afterPhysics();
            }
        }
        this.events.drainCollisionEvents((first, second, started) => {
            const a = physics.getCollider(first)?.parent()?.userData;
            const b = physics.getCollider(second)?.parent()?.userData;
            if (a === undefined || b === undefined || a === b || !a.alive || !b.alive) {
                return;
            }
            a.touch(b, started);
            if (a.alive && b.alive) {
                b.touch(a, started);
            }
        });
    }
    frame(socket, visible) {
        if (socket.room !== this) {
            throw new Error(`Socket ${socket.id} is not in room ${this.inviteCode}`);
        }
        return this.replication.frame(socket.seen, visible, this.time);
    }
    broadcast(event, ...data) {
        this.network.broadcast(this.inviteCode, event, ...data);
        return this;
    }
    clean() {
        for (const entity of this.entities.values()) {
            if (entity.alive && entity.isDirty) {
                entity.clean();
            }
        }
        this.replication.reset();
    }
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        for (const socket of [...this.sockets]) {
            this.leave(socket);
        }
        super.destroy();
        this.replication.reset();
        if (!this.ticking) {
            this.freePhysics();
        }
    }
    freePhysics() {
        this.physics.free();
        this.events.free();
    }
    get hasAvailableSocketSlots() {
        return this.sockets.size < this.maxPlayers;
    }
}
