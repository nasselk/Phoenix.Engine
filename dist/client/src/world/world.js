import { Group } from "three";
import { World as BaseWorld } from "../../../shared/world/world";
export class World extends BaseWorld {
    constructor() {
        super(...arguments);
        this.group = new Group();
    }
    allocateID() {
        return this.ids.allocateNegative();
    }
    spawn(kind, ...args) {
        const Kind = this.registry.class(kind);
        const options = (args[0] ?? {});
        const entity = new Kind(this, this.context, options);
        return this.insert(kind, entity, options.id);
    }
    sync(reader) {
        const registry = this.registry;
        const despawns = reader.readUint16();
        for (let i = 0; i < despawns; i++) {
            this.get(reader.readUint16())?.destroy();
        }
        const spawns = reader.readUint16();
        for (let i = 0; i < spawns; i++) {
            const code = reader.readUint8();
            const id = reader.readUint16();
            const kind = registry.kind(code);
            if (kind === undefined) {
                throw new Error(`Entity ${id} spawned as unknown kind ${code}, so the rest of the frame cannot be read; this build knows [ ${registry.describe()} ]`);
            }
            const existing = this.get(id);
            if (existing !== undefined && existing.kind === kind) {
                existing.deserialize(reader);
            }
            else {
                existing?.destroy();
                const entity = new (registry.class(kind))(this, this.context, { id });
                entity.deserialize(reader);
                this.insert(kind, entity, id);
            }
            reader.resetBits();
        }
        const updates = reader.readUint16();
        for (let i = 0; i < updates; i++) {
            const id = reader.readUint16();
            const entity = this.get(id);
            if (entity === undefined) {
                throw new Error(`Update for entity ${id}, which this world does not have, so the rest of the frame cannot be read`);
            }
            entity.deserializeUpdate(reader);
            reader.resetBits();
        }
    }
    destroy() {
        super.destroy();
        this.group.removeFromParent();
    }
}
