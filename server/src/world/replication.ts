import { BufferWriter } from "@nasselk/binarypack";
import type { EntityRegistry } from "../../../shared/world/registry";
import type { Entity } from "./entities/entity";

/** What each room starts with for its entity records and for the frame being built. Both grow when a tick needs more, and stay grown. */
export const REPLICATION_BUFFER_SIZE = 16 * 1024;

/**
 * Where an entity's records sit in its room's buffer, for the generation they were written in. -1 is
 * not written yet. It lives on the entity so a frame finds it by reading a field rather than by
 * hashing the entity, which is the lookup every socket pays for every entity it can see.
 */
export class Slot {
	generation: number;
	spawnStart: number;
	spawnEnd: number;
	updateStart: number;
	updateEnd: number;

	public constructor() {
		this.generation = -1;
		this.spawnStart = -1;
		this.spawnEnd = -1;
		this.updateStart = -1;
		this.updateEnd = -1;
	}
}

/** The entities one socket holds a copy of, as of the last frame built for it. */
export class Seen {
	public known: Set<Entity<any>>;
	public next: Set<Entity<any>>;

	public constructor() {
		this.known = new Set();
		this.next = new Set();
	}

	public clear(): void {
		this.known.clear();
		this.next.clear();
	}
}

/**
 * Builds each socket's frame out of records that are written once per tick, however many sockets need them.
 *
 * An entity's spawn record (`[code u8][id u16][serialize]`) and update record (`[id u16][serializeUpdate]`)
 * are written the first time any frame needs them, into one buffer, and every frame copies the bytes
 * from there. A frame is:
 *
 *   [u16 despawns][id]…  [u16 spawns][spawn record]…  [u16 updates][update record]…
 *
 * Records carry no length: the client reads each one with the entity's own `deserialize` or
 * `deserializeUpdate`, which have to read exactly what their server side wrote. Despawns go first,
 * so an id that died and came back as another entity is freed before it is reused.
 */
export class Replication {
	private readonly records = new BufferWriter(REPLICATION_BUFFER_SIZE, true);
	private readonly writer = new BufferWriter(REPLICATION_BUFFER_SIZE, true);

	private generation = 0;

	public constructor(private readonly registry: EntityRegistry<any>) {}

	/** Forget every record: the entities changed, or their changes were sent. */
	public reset(): void {
		this.generation++;
		this.records.reset();
	}

	/**
	 * The frame that takes a socket from what it has to `visible`, as a view that is only valid until the
	 * next frame is built. Undefined when there is nothing to tell it.
	 *
	 * Byte 0 is left free for the protocol to put the event code in.
	 */
	public frame(seen: Seen, visible: Iterable<Entity<any>>): Uint8Array<ArrayBuffer> | undefined {
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

		return writer.buffer.subarray(0, writer.offset) as Uint8Array<ArrayBuffer>;
	}

	private slot(entity: Entity<any>): Slot {
		const slot = entity.slot;

		if (slot.generation !== this.generation) {
			slot.generation = this.generation;
			slot.spawnStart = slot.spawnEnd = slot.updateStart = slot.updateEnd = -1;
		}

		return slot;
	}

	private spawn(entity: Entity<any>): Slot {
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

	/** An empty record when the entity has nothing to update. */
	private update(entity: Entity<any>): Slot {
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

	/**
	 * A record into the frame. Records are tens of bytes, where a `writeBuffer` spends more on the view
	 * it builds to copy them than on the copy itself, and leaves it behind for the collector.
	 */
	private copy(start: number, end: number): void {
		const writer = this.writer;
		const length = end - start;

		if (writer.offset + length > writer.byteLength) {
			writer.expand(writer.offset + length - writer.byteLength);
		}

		const source = this.records.buffer;
		const target = writer.buffer;
		const at = writer.advanceBytes(length);

		for (let i = 0; i < length; i++) {
			target[at + i] = source[start + i]!;
		}
	}
}
