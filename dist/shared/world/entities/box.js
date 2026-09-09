import { MovingEntity } from "./moving";
export class BoxEntity extends MovingEntity {
    constructor(x = 0, y = 0, z = 0, width = 1, height = width, depth = width, color = 0xffffff) {
        super(x, y, z);
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.color = color;
    }
    setSize(width, height = width, depth = width) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        return this;
    }
    serialize(writer) {
        super.serialize(writer);
        writer.writeFloat32(this.width);
        writer.writeFloat32(this.height);
        writer.writeFloat32(this.depth);
        writer.writeUint32(this.color);
    }
    deserialize(reader) {
        super.deserialize(reader);
        this.width = reader.readFloat32();
        this.height = reader.readFloat32();
        this.depth = reader.readFloat32();
        this.color = reader.readUint32();
    }
}
export class Floor extends BoxEntity {
    constructor(size = 200, thickness = 1, color = 0x3a3a3a) {
        super(0, -thickness / 2, 0, size, thickness, size, color);
    }
}
