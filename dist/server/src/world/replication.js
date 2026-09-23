import { BufferWriter } from "@nasselk/binarypack";
export const REPLICATION_BUFFER_SIZE = 16 * 1024;
export class Slot {
    constructor() {
        this.generation = -1;
        this.spawnStart = -1;
        this.spawnEnd = -1;
        this.updateStart = -1;
        this.updateEnd = -1;
    }
}
export class Seen {
    constructor() {
        this.known = new Set();
        this.next = new Set();
    }
    clear() {
        this.known.clear();
        this.next.clear();
    }
}
export class Replication {
    constructor(registry) {
        this.registry = registry;
        this.records = new BufferWriter(REPLICATION_BUFFER_SIZE, true);
        this.writer = new BufferWriter(REPLICATION_BUFFER_SIZE, true);
        this.generation = 0;
    }
    reset() {
        this.generation++;
        this.records.reset();
    }
    frame(seen, visible) {
        const { known, next } = seen;
        const writer = this.writer;
        for (const entity of visible) {
            if (entity.alive) {
                next.add(entity);
            }
        }
        writer.reset(1);
        const despawnCountOffset = writer.advanceBytes(2);
        let despawns = 0;
        for (const entity of known) {
            if (!next.has(entity)) {
                writer.writeUint16(entity.id);
                despawns++;
            }
        }
        writer.writeUint16(despawns, despawnCountOffset);
        const spawnCountOffset = writer.advanceBytes(2);
        let spawns = 0;
        for (const entity of next) {
            if (!known.has(entity)) {
                const slot = this.spawn(entity);
                this.copy(slot.spawnStart, slot.spawnEnd);
                spawns++;
            }
        }
        writer.writeUint16(spawns, spawnCountOffset);
        const updateCountOffset = writer.advanceBytes(2);
        let updates = 0;
        for (const entity of next) {
            if (known.has(entity)) {
                const slot = this.update(entity);
                if (slot.updateEnd > slot.updateStart) {
                    this.copy(slot.updateStart, slot.updateEnd);
                    updates++;
                }
            }
        }
        writer.writeUint16(updates, updateCountOffset);
        known.clear();
        seen.known = next;
        seen.next = known;
        if (despawns === 0 && spawns === 0 && updates === 0) {
            return undefined;
        }
        return writer.buffer.subarray(0, writer.offset);
    }
    slot(entity) {
        const slot = entity.slot;
        if (slot.generation !== this.generation) {
            slot.generation = this.generation;
            slot.spawnStart = slot.spawnEnd = slot.updateStart = slot.updateEnd = -1;
        }
        return slot;
    }
    spawn(entity) {
        const slot = this.slot(entity);
        if (slot.spawnEnd >= 0) {
            return slot;
        }
        const records = this.records;
        slot.spawnStart = records.offset;
        records.writeUint8(this.registry.code(entity.kind));
        records.writeUint16(entity.id);
        entity.serialize(records);
        records.resetBits();
        slot.spawnEnd = records.offset;
        return slot;
    }
    update(entity) {
        const slot = this.slot(entity);
        if (slot.updateEnd >= 0) {
            return slot;
        }
        const records = this.records;
        slot.updateStart = records.offset;
        if (entity.isDirty) {
            records.writeUint16(entity.id);
            entity.serializeUpdate(records);
            records.resetBits();
        }
        slot.updateEnd = records.offset;
        return slot;
    }
    copy(start, end) {
        const writer = this.writer;
        const length = end - start;
        if (writer.offset + length > writer.byteLength) {
            writer.expand(writer.offset + length - writer.byteLength);
        }
        const source = this.records.buffer;
        const target = writer.buffer;
        const at = writer.advanceBytes(length);
        for (let i = 0; i < length; i++) {
            target[at + i] = source[start + i];
        }
    }
}
