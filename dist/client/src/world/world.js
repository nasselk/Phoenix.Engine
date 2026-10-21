import { Group } from "three";
import { World as BaseWorld } from "../../../shared/world/world";
export class World extends BaseWorld {
    constructor() {
        super(...arguments);
        this.group = new Group();
        this.serverTime = 0;
        this.framesReceived = 0;
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
        this.framesReceived++;
        this.serverTime = reader.readUint32() / 1000;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ybGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jbGllbnQvc3JjL3dvcmxkL3dvcmxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFJOUIsT0FBTyxFQUFFLEtBQUssSUFBSSxTQUFTLEVBQXFCLE1BQU0sNkJBQTZCLENBQUM7QUFLcEYsTUFBTSxPQUFPLEtBQXNDLFNBQVEsU0FBMEI7SUFBckY7O1FBRWlCLFVBQUssR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQzdCLGVBQVUsR0FBVyxDQUFDLENBQUM7UUFHdkIsbUJBQWMsR0FBVyxDQUFDLENBQUM7SUF5Rm5DLENBQUM7SUFuRm1CLFVBQVU7UUFDNUIsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDcEMsQ0FBQztJQUVNLEtBQUssQ0FBcUMsSUFBTyxFQUFFLEdBQUcsSUFBNkI7UUFDekYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUF1QyxDQUFDO1FBRXRFLE1BQU0sTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBdUIsQ0FBQztRQUUzRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQVVNLElBQUksQ0FBQyxNQUFvQjtRQUMvQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBRS9CLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFV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