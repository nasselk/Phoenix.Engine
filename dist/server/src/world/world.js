import { BufferWriter } from "@nasselk/binarypack";
import { warn } from "../../../shared/utils/logger";
import { World as BaseWorld } from "../../../shared/world/world";
export const MAX_SERVER_WORLD_SIZE = 2 ** 16 - 1;
export class World extends BaseWorld {
    constructor(options = {}) {
        super({ ...options, role: options.role ?? "authority" });
        this.pendingSpawns = [];
        this.pendingDespawns = [];
        if (this.capacity > MAX_SERVER_WORLD_SIZE) {
            throw new Error(`World capacity must be at most ${MAX_SERVER_WORLD_SIZE}, got ${this.capacity}`);
        }
        this.id = options.id ?? 0;
        this.inviteCode = options.inviteCode ?? "";
        if (this.role !== "authority") {
            return;
        }
        this.on("spawn", (entity) => this.pendingSpawns.push(entity));
        this.on("destroy", (entity) => this.pendingDespawns.push(entity.id));
    }
    spawn(kind, ...args) {
        const Kind = this.requireRegistry("spawn").class(kind);
        const options = (args[0] ?? {});
        const entity = new Kind(this, this.context, options);
        return this.insert(kind, entity, options.id);
    }
    serialize(writer = new BufferWriter()) {
        const registry = this.requireRegistry("serialize");
        const countOffset = writer.advanceBytes(2);
        let count = 0;
        for (const entity of this.entities.values()) {
            if (entity.alive && this.writeSpawn(writer, registry, entity)) {
                count++;
            }
        }
        writer.writeUint16(count, countOffset);
        writer.writeUint16(0);
        writer.writeUint16(0);
        return writer;
    }
    allocateID() {
        const id = super.allocateID();
        if (id > MAX_SERVER_WORLD_SIZE) {
            throw new Error(`World id allocation exceeded ${MAX_SERVER_WORLD_SIZE}`);
        }
        return id;
    }
    serializeSync(writer) {
        const registry = this.requireRegistry("serializeSync");
        const spawns = this.pendingSpawns;
        const despawns = this.pendingDespawns;
        const start = writer.offset;
        const spawnCountOffset = writer.advanceBytes(2);
        let spawnCount = 0;
        for (let i = 0; i < spawns.length; i++) {
            const entity = spawns[i];
            if (entity.alive && this.writeSpawn(writer, registry, entity)) {
                entity.clean();
                spawnCount++;
            }
        }
        writer.writeUint16(spawnCount, spawnCountOffset);
        spawns.length = 0;
        const updateCountOffset = writer.advanceBytes(2);
        let updateCount = 0;
        for (const entity of this.entities.values()) {
            if (!entity.alive || !entity.isDirty) {
                continue;
            }
            writer.writeUint16(entity.id);
            const lengthOffset = writer.advanceBytes(2);
            const payload = writer.offset;
            entity.serializeUpdate(writer);
            writer.resetBits();
            writer.writeUint16(writer.offset - payload, lengthOffset);
            entity.clean();
            updateCount++;
        }
        writer.writeUint16(updateCount, updateCountOffset);
        writer.writeUint16(despawns.length);
        for (let i = 0; i < despawns.length; i++) {
            writer.writeUint16(despawns[i]);
        }
        const despawnCount = despawns.length;
        despawns.length = 0;
        if (spawnCount === 0 && updateCount === 0 && despawnCount === 0) {
            writer.offset = start;
            return false;
        }
        return true;
    }
    dispose() {
        super.dispose();
        this.pendingSpawns.length = 0;
        this.pendingDespawns.length = 0;
    }
    writeSpawn(writer, registry, entity) {
        if (entity.kind === "") {
            warn("World", `Not replicating entity ${entity.id} (${entity.type}): its class is not in the registry`);
            return false;
        }
        writer.writeUint8(registry.code(entity.kind));
        writer.writeUint16(entity.id);
        const lengthOffset = writer.advanceBytes(2);
        const payload = writer.offset;
        entity.serialize(writer);
        writer.resetBits();
        writer.writeUint16(writer.offset - payload, lengthOffset);
        return true;
    }
}
