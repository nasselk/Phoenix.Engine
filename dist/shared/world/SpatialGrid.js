export class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.keys = new Map();
        if (!(cellSize > 0)) {
            throw new RangeError("A grid's cell size must be above zero");
        }
    }
    insert(item) {
        if (this.keys.has(item)) {
            return this.update(item);
        }
        const key = this.keyOf(item.position);
        this.cell(key).push(item);
        this.keys.set(item, key);
        return this;
    }
    update(item) {
        const previous = this.keys.get(item);
        if (previous === undefined) {
            return this.insert(item);
        }
        const key = this.keyOf(item.position);
        if (key !== previous) {
            this.take(previous, item);
            this.cell(key).push(item);
            this.keys.set(item, key);
        }
        return this;
    }
    remove(item) {
        const key = this.keys.get(item);
        if (key === undefined) {
            return false;
        }
        this.take(key, item);
        this.keys.delete(item);
        return true;
    }
    has(item) {
        return this.keys.has(item);
    }
    query(center, radius, out = []) {
        out.length = 0;
        const size = this.cellSize;
        const radiusSquared = radius * radius;
        const minX = Math.floor((center.x - radius) / size);
        const minY = Math.floor((center.y - radius) / size);
        const minZ = Math.floor((center.z - radius) / size);
        const maxX = Math.floor((center.x + radius) / size);
        const maxY = Math.floor((center.y + radius) / size);
        const maxZ = Math.floor((center.z + radius) / size);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const cell = this.cells.get(SpatialGrid.pack(x, y, z));
                    if (cell === undefined) {
                        continue;
                    }
                    for (let i = 0; i < cell.length; i++) {
                        const item = cell[i];
                        const dx = item.position.x - center.x;
                        const dy = item.position.y - center.y;
                        const dz = item.position.z - center.z;
                        if (dx * dx + dy * dy + dz * dz <= radiusSquared) {
                            out.push(item);
                        }
                    }
                }
            }
        }
        return out;
    }
    clear() {
        this.cells.clear();
        this.keys.clear();
    }
    get size() {
        return this.keys.size;
    }
    keyOf(position) {
        const size = this.cellSize;
        return SpatialGrid.pack(Math.floor(position.x / size), Math.floor(position.y / size), Math.floor(position.z / size));
    }
    static pack(x, y, z) {
        return ((x & 0xffff) * 0x10000 + (y & 0xffff)) * 0x10000 + (z & 0xffff);
    }
    cell(key) {
        let cell = this.cells.get(key);
        if (cell === undefined) {
            cell = [];
            this.cells.set(key, cell);
        }
        return cell;
    }
    take(key, item) {
        const cell = this.cells.get(key);
        if (cell === undefined) {
            return;
        }
        const index = cell.indexOf(item);
        if (index !== -1) {
            cell[index] = cell[cell.length - 1];
            cell.pop();
        }
    }
}
