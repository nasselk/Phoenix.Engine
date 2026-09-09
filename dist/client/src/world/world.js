import { warn } from "../../../shared/utils/logger";
import { World as BaseWorld } from "../../../shared/world/world";
export class World extends BaseWorld {
    sync(reader) {
        const registry = this.requireRegistry("sync");
        const spawns = reader.readUint16();
        for (let i = 0; i < spawns; i++) {
            const code = reader.readUint8();
            const id = reader.readUint16();
            const length = reader.readUint16();
            const end = reader.offset + length;
            const kind = registry.name(code);
            if (kind === undefined) {
                warn("World", `Ignoring a spawn of unknown entity kind ${code}; this build knows [ ${registry.describe()} ]`);
            }
            else {
                const existing = this.entities.get(id);
                if (existing !== undefined && existing.kind === kind) {
                    existing.deserialize(reader);
                }
                else {
                    if (existing !== undefined) {
                        this.destroy(existing);
                    }
                    const entity = registry.instantiate(kind);
                    entity.deserialize(reader);
                    this.insert(entity, id, kind);
                }
            }
            reader.offset = end;
            reader.resetBits();
        }
        const updates = reader.readUint16();
        for (let i = 0; i < updates; i++) {
            const id = reader.readUint16();
            const length = reader.readUint16();
            const end = reader.offset + length;
            this.entities.get(id)?.deserializeUpdate(reader);
            reader.offset = end;
            reader.resetBits();
        }
        const despawns = reader.readUint16();
        for (let i = 0; i < despawns; i++) {
            this.destroy(reader.readUint16());
        }
    }
}
