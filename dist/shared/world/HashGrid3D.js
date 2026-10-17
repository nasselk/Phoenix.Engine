import { clamp } from "../math/utils";
import { removeFromArray } from "../utils/utils";
class Filed {
    constructor() {
        this.bucket = 0;
        this.halfX = 0;
        this.halfY = 0;
        this.halfZ = 0;
        this.minX = 0;
        this.minY = 0;
        this.minZ = 0;
        this.maxX = 0;
        this.maxY = 0;
        this.maxZ = 0;
        this.cellMinX = 0;
        this.cellMinY = 0;
        this.cellMinZ = 0;
        this.cellMaxX = 0;
        this.cellMaxY = 0;
        this.cellMaxZ = 0;
        this.queryID = 0;
        this.generation = 0;
    }
}
class Cell {
    constructor(buckets) {
        this.count = 0;
        this.buckets = Array.from({ length: buckets }, () => []);
    }
}
export class HashGrid3D {
    constructor({ cellSize, bounds, types }) {
        this.prune = (record, item) => {
            if (record.generation !== this.generation) {
                this.records.delete(item);
                this.release(record);
            }
        };
        this.records = new Map();
        this.pool = [];
        this.typeKeys = types === undefined ? [] : Object.keys(types);
        this.typeIndex = new Map(this.typeKeys.map((key, index) => [key, index]));
        this.classes = this.typeKeys.map((key) => types[key]);
        this.classIndex = new Map(this.classes.map((type, index) => [type, index]));
        this.result = (types === undefined ? [] : Object.fromEntries(this.typeKeys.map((key) => [key, []])));
        this.cells = [];
        this.originX = this.originY = this.originZ = 0;
        this.cellX = this.cellY = this.cellZ = 1;
        this.countX = this.countY = this.countZ = 1;
        this.halfX = this.halfY = this.halfZ = 0;
        this.rangeMinX = this.rangeMinY = this.rangeMinZ = 0;
        this.rangeMaxX = this.rangeMaxY = this.rangeMaxZ = 0;
        this.queryID = 0;
        this.busy = false;
        this.generation = 1;
        this.live = 0;
        this.layout(bounds, cellSize);
    }
    insert(item, size, type) {
        this.assertIdle();
        let record = this.records.get(item);
        if (record?.generation === this.generation) {
            return this.update(item, size);
        }
        if (record === undefined) {
            record = this.pool.pop() ?? new Filed();
            record.item = item;
            this.records.set(item, record);
        }
        record.generation = this.generation;
        record.bucket = this.bucketOf(item, type);
        record.queryID = 0;
        this.readSize(size);
        record.halfX = this.halfX;
        record.halfY = this.halfY;
        record.halfZ = this.halfZ;
        this.place(record);
        this.file(record);
        this.live++;
        return this;
    }
    update(item, size) {
        this.assertIdle();
        const record = this.records.get(item);
        if (record?.generation !== this.generation) {
            return this.insert(item, size);
        }
        if (size !== undefined) {
            this.readSize(size);
            record.halfX = this.halfX;
            record.halfY = this.halfY;
            record.halfZ = this.halfZ;
        }
        const { cellMinX, cellMinY, cellMinZ, cellMaxX, cellMaxY, cellMaxZ } = record;
        this.place(record);
        if (record.cellMinX !== cellMinX || record.cellMinY !== cellMinY || record.cellMinZ !== cellMinZ || record.cellMaxX !== cellMaxX || record.cellMaxY !== cellMaxY || record.cellMaxZ !== cellMaxZ) {
            this.unfile(record.bucket, record, cellMinX, cellMinY, cellMinZ, cellMaxX, cellMaxY, cellMaxZ);
            this.file(record);
        }
        return this;
    }
    remove(item) {
        this.assertIdle();
        const record = this.records.get(item);
        if (record?.generation !== this.generation) {
            return false;
        }
        this.unfile(record.bucket, record, record.cellMinX, record.cellMinY, record.cellMinZ, record.cellMaxX, record.cellMaxY, record.cellMaxZ);
        this.records.delete(item);
        this.release(record);
        this.live--;
        return true;
    }
    has(item) {
        return this.records.get(item)?.generation === this.generation;
    }
    query(center, size = 0, out = this.result) {
        this.assertIdle();
        const typed = this.typeKeys.length > 0;
        if (typed) {
            for (const key of this.typeKeys) {
                out[key].length = 0;
            }
        }
        else {
            out.length = 0;
        }
        this.aim(center, size);
        const queryID = this.nextQueryID();
        for (let z = this.rangeMinZ; z <= this.rangeMaxZ; z++) {
            for (let y = this.rangeMinY; y <= this.rangeMaxY; y++) {
                for (let x = this.rangeMinX; x <= this.rangeMaxX; x++) {
                    const cell = this.cells[this.index(x, y, z)];
                    if (cell === null || cell === undefined || cell.count === 0) {
                        continue;
                    }
                    for (let bucket = 0; bucket < cell.buckets.length; bucket++) {
                        const records = cell.buckets[bucket];
                        const target = typed ? out[this.typeKeys[bucket]] : out;
                        for (let i = 0; i < records.length; i++) {
                            const record = records[i];
                            if (record.queryID !== queryID) {
                                record.queryID = queryID;
                                if (this.overlapsQuery(record, center)) {
                                    target.push(record.item);
                                }
                            }
                        }
                    }
                }
            }
        }
        return out;
    }
    each(center, size, callback, type) {
        this.assertIdle();
        this.aim(center, size);
        const queryID = this.nextQueryID();
        const only = type === undefined ? -1 : this.typeIndex.get(type);
        this.busy = true;
        try {
            for (let z = this.rangeMinZ; z <= this.rangeMaxZ; z++) {
                for (let y = this.rangeMinY; y <= this.rangeMaxY; y++) {
                    for (let x = this.rangeMinX; x <= this.rangeMaxX; x++) {
                        const cell = this.cells[this.index(x, y, z)];
                        if (cell === null || cell === undefined || cell.count === 0) {
                            continue;
                        }
                        for (let bucket = only === -1 ? 0 : only; bucket < (only === -1 ? cell.buckets.length : only + 1); bucket++) {
                            const records = cell.buckets[bucket];
                            for (let i = 0; i < records.length; i++) {
                                const record = records[i];
                                if (record.queryID !== queryID) {
                                    record.queryID = queryID;
                                    if (this.overlapsQuery(record, center) && callback(record.item)) {
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        finally {
            this.busy = false;
        }
        return false;
    }
    pairs(callback) {
        this.assertIdle();
        let count = 0;
        let index = 0;
        this.busy = true;
        try {
            for (let z = 0; z < this.countZ; z++) {
                for (let y = 0; y < this.countY; y++) {
                    for (let x = 0; x < this.countX; x++, index++) {
                        const cell = this.cells[index];
                        if (cell === null || cell === undefined || cell.count < 2) {
                            continue;
                        }
                        const { buckets } = cell;
                        for (let firstBucket = 0; firstBucket < buckets.length; firstBucket++) {
                            const firsts = buckets[firstBucket];
                            for (let i = 0; i < firsts.length; i++) {
                                const first = firsts[i];
                                for (let secondBucket = firstBucket; secondBucket < buckets.length; secondBucket++) {
                                    const seconds = buckets[secondBucket];
                                    for (let j = secondBucket === firstBucket ? i + 1 : 0; j < seconds.length; j++) {
                                        const second = seconds[j];
                                        if (HashGrid3D.firstShared(first, second, x, y, z) && HashGrid3D.overlap(first, second)) {
                                            callback(first.item, second.item);
                                            count++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        finally {
            this.busy = false;
        }
        return count;
    }
    clear() {
        this.assertIdle();
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            if (cell !== null && cell !== undefined && cell.count > 0) {
                for (const bucket of cell.buckets) {
                    bucket.length = 0;
                }
                cell.count = 0;
            }
        }
        this.records.forEach(this.prune);
        this.generation++;
        this.live = 0;
        return this;
    }
    resize(bounds, cellSize = { x: this.cellX, y: this.cellY, z: this.cellZ }) {
        this.assertIdle();
        this.layout(bounds, cellSize);
        for (const record of this.records.values()) {
            if (record.generation === this.generation) {
                this.place(record);
                this.file(record);
            }
        }
        return this;
    }
    get size() {
        return this.live;
    }
    get cellCount() {
        return this.cells.length;
    }
    layout(bounds, cellSize) {
        const sizeX = typeof cellSize === "number" ? cellSize : cellSize.x;
        const sizeY = typeof cellSize === "number" ? cellSize : cellSize.y;
        const sizeZ = typeof cellSize === "number" ? cellSize : cellSize.z;
        if (!(sizeX > 0 && sizeY > 0 && sizeZ > 0)) {
            throw new RangeError("A grid's cell size must be above zero");
        }
        if (!(bounds.max.x >= bounds.min.x && bounds.max.y >= bounds.min.y && bounds.max.z >= bounds.min.z)) {
            throw new RangeError("A grid's bounds must have their max at or above their min");
        }
        this.originX = bounds.min.x;
        this.originY = bounds.min.y;
        this.originZ = bounds.min.z;
        this.cellX = sizeX;
        this.cellY = sizeY;
        this.cellZ = sizeZ;
        this.countX = Math.max(Math.ceil((bounds.max.x - bounds.min.x) / sizeX), 1);
        this.countY = Math.max(Math.ceil((bounds.max.y - bounds.min.y) / sizeY), 1);
        this.countZ = Math.max(Math.ceil((bounds.max.z - bounds.min.z) / sizeZ), 1);
        this.cells = new Array(this.countX * this.countY * this.countZ).fill(null);
    }
    index(x, y, z) {
        return (z * this.countY + y) * this.countX + x;
    }
    cellOf(value, origin, size, count) {
        return clamp((value - origin) / size, 0, count - 1) | 0;
    }
    readSize(size) {
        if (size === undefined) {
            this.halfX = this.halfY = this.halfZ = 0;
        }
        else if (typeof size === "number") {
            this.halfX = this.halfY = this.halfZ = size / 2;
        }
        else {
            this.halfX = size.x / 2;
            this.halfY = size.y / 2;
            this.halfZ = size.z / 2;
        }
    }
    place(record) {
        const { x, y, z } = record.item.position;
        record.minX = x - record.halfX;
        record.minY = y - record.halfY;
        record.minZ = z - record.halfZ;
        record.maxX = x + record.halfX;
        record.maxY = y + record.halfY;
        record.maxZ = z + record.halfZ;
        record.cellMinX = this.cellOf(record.minX, this.originX, this.cellX, this.countX);
        record.cellMinY = this.cellOf(record.minY, this.originY, this.cellY, this.countY);
        record.cellMinZ = this.cellOf(record.minZ, this.originZ, this.cellZ, this.countZ);
        record.cellMaxX = this.cellOf(record.maxX, this.originX, this.cellX, this.countX);
        record.cellMaxY = this.cellOf(record.maxY, this.originY, this.cellY, this.countY);
        record.cellMaxZ = this.cellOf(record.maxZ, this.originZ, this.cellZ, this.countZ);
    }
    aim(center, size) {
        this.readSize(size);
        this.rangeMinX = this.cellOf(center.x - this.halfX, this.originX, this.cellX, this.countX);
        this.rangeMinY = this.cellOf(center.y - this.halfY, this.originY, this.cellY, this.countY);
        this.rangeMinZ = this.cellOf(center.z - this.halfZ, this.originZ, this.cellZ, this.countZ);
        this.rangeMaxX = this.cellOf(center.x + this.halfX, this.originX, this.cellX, this.countX);
        this.rangeMaxY = this.cellOf(center.y + this.halfY, this.originY, this.cellY, this.countY);
        this.rangeMaxZ = this.cellOf(center.z + this.halfZ, this.originZ, this.cellZ, this.countZ);
    }
    file(record) {
        for (let z = record.cellMinZ; z <= record.cellMaxZ; z++) {
            for (let y = record.cellMinY; y <= record.cellMaxY; y++) {
                for (let x = record.cellMinX; x <= record.cellMaxX; x++) {
                    const index = this.index(x, y, z);
                    const cell = this.cells[index] ?? (this.cells[index] = new Cell(Math.max(this.typeKeys.length, 1)));
                    cell.buckets[record.bucket].push(record);
                    cell.count++;
                }
            }
        }
    }
    unfile(bucket, record, minX, minY, minZ, maxX, maxY, maxZ) {
        for (let z = minZ; z <= maxZ; z++) {
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const cell = this.cells[this.index(x, y, z)];
                    if (cell !== null && cell !== undefined) {
                        removeFromArray(cell.buckets[bucket], record);
                        cell.count--;
                    }
                }
            }
        }
    }
    release(record) {
        record.item = undefined;
        this.pool.push(record);
    }
    bucketOf(item, type) {
        if (this.typeKeys.length === 0) {
            return 0;
        }
        if (type !== undefined) {
            const bucket = this.typeIndex.get(type);
            if (bucket === undefined) {
                throw new Error(`"${type}" is not one of this grid's types`);
            }
            return bucket;
        }
        const exact = this.classIndex.get(item.constructor);
        if (exact !== undefined) {
            return exact;
        }
        for (let bucket = 0; bucket < this.classes.length; bucket++) {
            if (item instanceof this.classes[bucket]) {
                return bucket;
            }
        }
        throw new Error(`${item.constructor.name} is not one of this grid's types`);
    }
    overlapsQuery(record, center) {
        return record.minX <= center.x + this.halfX && record.maxX >= center.x - this.halfX && record.minY <= center.y + this.halfY && record.maxY >= center.y - this.halfY && record.minZ <= center.z + this.halfZ && record.maxZ >= center.z - this.halfZ;
    }
    nextQueryID() {
        this.queryID = this.queryID === Number.MAX_SAFE_INTEGER ? 1 : this.queryID + 1;
        return this.queryID;
    }
    assertIdle() {
        if (this.busy) {
            throw new Error("A grid cannot be changed or queried from inside its own each() or pairs()");
        }
    }
    static firstShared(first, second, x, y, z) {
        return Math.max(first.cellMinX, second.cellMinX) === x && Math.max(first.cellMinY, second.cellMinY) === y && Math.max(first.cellMinZ, second.cellMinZ) === z;
    }
    static overlap(first, second) {
        return first.minX <= second.maxX && first.maxX >= second.minX && first.minY <= second.maxY && first.maxY >= second.minY && first.minZ <= second.maxZ && first.maxZ >= second.minZ;
    }
}
