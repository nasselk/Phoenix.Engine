import { Vector3 } from "../math/vector3";
import { removeFromArray } from "../utils/utils";
import { clamp } from "../math/utils";
class HashGrid3D {
    constructor(cellWidth, cellHeight = cellWidth, cellDepth = cellHeight, bounds, removableObjects = true, types) {
        this.bounds = {
            min: new Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
            max: new Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
        };
        this.id = HashGrid3D.gridCount++;
        this.cellWidth = Math.max(cellWidth, 1);
        this.cellHeight = Math.max(cellHeight, 1);
        this.cellDepth = Math.max(cellDepth, 1);
        this.removableObjects = removableObjects;
        this.maxKeyX = Math.ceil((this.bounds.max.x - this.bounds.min.x) / this.cellWidth);
        this.maxKeyY = Math.ceil((this.bounds.max.y - this.bounds.min.y) / this.cellHeight);
        this.maxKeyZ = Math.ceil((this.bounds.max.z - this.bounds.min.z) / this.cellDepth);
        this.maxKey = this.getCellID(this.maxKeyX, this.maxKeyY, this.maxKeyZ);
        this.cells = new Array(this.maxKey + 1).fill(null);
        this.cellActivity = new Uint32Array(this.maxKey + 1);
        this.boundsBuffer = new Uint32Array(6);
        this.activityVersion = 0;
        this.typed = Boolean(types);
        this.cellKeys = new Set();
        this.types = types;
        this.totalEntitiesInCells = 0;
        this.entityCount = 0;
        this.queryID = 0;
        if (this.typed) {
            this.query2OutputCache = Object.keys(this.types).reduce((acc, type) => {
                acc[type] = [];
                return acc;
            }, {});
            this.typesKeys = Object.keys(this.types);
        }
        else {
            this.query2OutputCache = [];
        }
    }
    resize(bounds, cellWidth = this.cellWidth, cellHeight = this.cellHeight, cellDepth = this.cellDepth, restore = true) {
        const cells = this.cells;
        const entities = new Set();
        this.bounds.min.set(bounds.min);
        this.bounds.max.set(bounds.max);
        this.cellWidth = Math.max(cellWidth, 1);
        this.cellHeight = Math.max(cellHeight, 1);
        this.cellDepth = Math.max(cellDepth, 1);
        this.maxKeyX = Math.ceil((this.bounds.max.x - this.bounds.min.x) / this.cellWidth);
        this.maxKeyY = Math.ceil((this.bounds.max.y - this.bounds.min.y) / this.cellHeight);
        this.maxKeyZ = Math.ceil((this.bounds.max.z - this.bounds.min.z) / this.cellDepth);
        this.maxKey = this.getCellID(this.maxKeyX, this.maxKeyY, this.maxKeyZ);
        this.cells = new Array(this.maxKey + 1).fill(null);
        this.cellActivity = new Uint32Array(this.maxKey + 1);
        this.totalEntitiesInCells = 0;
        this.entityCount = 0;
        if (restore || this.removableObjects) {
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                if (cell) {
                    if (cell.typed) {
                        for (const type in cell.objects) {
                            for (let j = 0; j < cell.objects[type].length; j++) {
                                const object = cell.objects[type][j];
                                object.cellsKeys[this.id]?.clear();
                                if (restore) {
                                    entities.add(object);
                                }
                            }
                        }
                    }
                    else {
                        for (let j = 0; j < cell.objects.length; j++) {
                            const object = cell.objects[j];
                            object.cellsKeys[this.id]?.clear();
                            if (restore) {
                                entities.add(object);
                            }
                        }
                    }
                }
            }
        }
        if (restore) {
            for (const entity of entities) {
                this.insert(entity, entity.size.x, entity.size.y, entity.size.z, entity.type);
            }
        }
        return this;
    }
    initCells() {
        for (let i = 0; i <= this.maxKey; i++) {
            void this.createCell(i);
        }
        return this;
    }
    getCellID(x, y, z) {
        return (z * (this.maxKeyY + 1) + y) * (this.maxKeyX + 1) + x;
    }
    createCell(key) {
        let cell;
        if (this.typed) {
            cell = new TypedCell(key, this.types);
        }
        else {
            cell = new UntypedCell(key);
        }
        this.cells[key] = cell;
        return cell;
    }
    getCell(key) {
        const cell = this.cells[key] || this.createCell(key);
        return cell;
    }
    getBounds(object, rangeX = object.size.x, rangeY = object.size.y, rangeZ = object.size.z) {
        const localX = object.position.x - this.bounds.min.x;
        const localY = object.position.y - this.bounds.min.y;
        const localZ = object.position.z - this.bounds.min.z;
        this.boundsBuffer[0] = clamp((localX - rangeX / 2) / this.cellWidth, 0, this.maxKeyX) | 0;
        this.boundsBuffer[1] = clamp((localY - rangeY / 2) / this.cellHeight, 0, this.maxKeyY) | 0;
        this.boundsBuffer[2] = clamp((localZ - rangeZ / 2) / this.cellDepth, 0, this.maxKeyZ) | 0;
        this.boundsBuffer[3] = clamp((localX + rangeX / 2) / this.cellWidth, 0, this.maxKeyX) | 0;
        this.boundsBuffer[4] = clamp((localY + rangeY / 2) / this.cellHeight, 0, this.maxKeyY) | 0;
        this.boundsBuffer[5] = clamp((localZ + rangeZ / 2) / this.cellDepth, 0, this.maxKeyZ) | 0;
        return this.boundsBuffer;
    }
    insert(object, rangeX, rangeY, rangeZ, type = object.type) {
        const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
        const minX = bounds[0];
        const minY = bounds[1];
        const minZ = bounds[2];
        const maxX = bounds[3];
        const maxY = bounds[4];
        const maxZ = bounds[5];
        let cellsKeys;
        if (this.removableObjects) {
            cellsKeys = object.cellsKeys[this.id];
            cellsKeys = new Set();
            object.cellsKeys[this.id] = cellsKeys;
        }
        else {
            object.cellMinX = minX;
            object.cellMinY = minY;
            object.cellMinZ = minZ;
        }
        this.entityCount++;
        const version = ++this.activityVersion;
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = this.getCellID(x, y, z);
                    this.cellActivity[key] = version;
                    const cell = this.getCell(key);
                    this.totalEntitiesInCells++;
                    if (cell.typed) {
                        cell.insert(object, type, cellsKeys);
                    }
                    else {
                        cell.insert(object, cellsKeys);
                    }
                }
            }
        }
        return this;
    }
    remove(object, type = object.type) {
        const cellsKeys = object.cellsKeys[this.id];
        this.entityCount--;
        for (const key of cellsKeys) {
            const cell = this.cells[key];
            if (cell) {
                this.totalEntitiesInCells--;
                if (cell.typed) {
                    cell.remove(object, type, cellsKeys);
                }
                else {
                    cell.remove(object, cellsKeys);
                }
                if (cell.count === 0) {
                    this.cells[key] = null;
                }
            }
        }
        return this;
    }
    update(object, rangeX, rangeY, rangeZ, type = object.type) {
        const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
        const minX = bounds[0];
        const minY = bounds[1];
        const minZ = bounds[2];
        const maxX = bounds[3];
        const maxY = bounds[4];
        const maxZ = bounds[5];
        const oldCells = object.cellsKeys[this.id];
        const newCells = this.cellKeys;
        newCells.clear();
        const version = ++this.activityVersion;
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = this.getCellID(x, y, z);
                    this.cellActivity[key] = version;
                    if (!oldCells.has(key)) {
                        const cell = this.getCell(key);
                        this.totalEntitiesInCells++;
                        if (cell.typed) {
                            cell.insert(object, type);
                        }
                        else {
                            cell.insert(object);
                        }
                    }
                    newCells.add(key);
                }
            }
        }
        for (const key of oldCells) {
            if (!newCells.has(key)) {
                const cell = this.cells[key];
                this.totalEntitiesInCells--;
                if (cell) {
                    if (cell.typed) {
                        cell.remove(object, type);
                    }
                    else {
                        cell.remove(object);
                    }
                }
            }
        }
        this.cellKeys = oldCells;
        object.cellsKeys[this.id] = newCells;
        return this;
    }
    query(object, callback, rangeX, rangeY, rangeZ, param1, param2) {
        const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
        const minX = bounds[0];
        const minY = bounds[1];
        const minZ = bounds[2];
        const maxX = bounds[3];
        const maxY = bounds[4];
        const maxZ = bounds[5];
        const queryID = this.incrementQueryID();
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = this.getCellID(x, y, z);
                    const cell = this.cells[key];
                    if (cell) {
                        const exit = callback.call(object, cell.objects, queryID, param1, param2);
                        if (exit) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    query2(object, rangeX, rangeY, rangeZ) {
        const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
        const minX = bounds[0];
        const minY = bounds[1];
        const minZ = bounds[2];
        const maxX = bounds[3];
        const maxY = bounds[4];
        const maxZ = bounds[5];
        this.clearQuery2OutputCache();
        const queryID = this.incrementQueryID();
        let output = this.query2OutputCache;
        const types = this.typesKeys;
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = this.getCellID(x, y, z);
                    const cell = this.cells[key];
                    if (cell) {
                        if (cell.typed) {
                            for (let i = 0; i < types.length; i++) {
                                const type = types[i];
                                const objects = cell.objects[type];
                                for (let j = 0; j < objects.length; j++) {
                                    const object = objects[j];
                                    if (object.queryID !== queryID) {
                                        output[type].push(object);
                                        object.queryID = queryID;
                                    }
                                }
                            }
                        }
                        else {
                            for (let i = 0; i < cell.objects.length; i++) {
                                const object = cell.objects[i];
                                if (object.queryID !== queryID) {
                                    output.push(object);
                                    object.queryID = queryID;
                                }
                            }
                        }
                    }
                }
            }
        }
        return output;
    }
    incrementQueryID() {
        if (this.queryID === Number.MAX_SAFE_INTEGER - 1) {
            this.queryID = 0;
        }
        else {
            this.queryID++;
        }
        return this.queryID;
    }
    clearQuery2OutputCache() {
        const cache = this.query2OutputCache;
        if (this.typed) {
            const types = this.typesKeys;
            for (let i = 0; i < types.length; i++) {
                cache[types[i]].length = 0;
            }
        }
        else {
            cache.length = 0;
        }
        return this;
    }
    pairsQuery(callback) {
        let count = 0;
        if (this.typed) {
            throw new Error("Typed cells are not supported for pairwiseCombination. Use Untyped cells instead.");
        }
        const stride = this.maxKeyX + 1;
        const slice = stride * (this.maxKeyY + 1);
        for (let key = 0; key < this.cells.length; key++) {
            const cell = this.cells[key];
            if (cell === null || cell.count < 2) {
                continue;
            }
            const rest = key % slice;
            const cellZ = (key - rest) / slice;
            const cellX = rest % stride;
            const cellY = (rest - cellX) / stride;
            for (let i = 0; i < cell.count; i++) {
                const entity1 = cell.objects[i];
                if (!entity1.alive) {
                    continue;
                }
                const minX1 = entity1.cellMinX;
                const minY1 = entity1.cellMinY;
                const minZ1 = entity1.cellMinZ;
                for (let j = i + 1; j < cell.count; j++) {
                    const entity2 = cell.objects[j];
                    if (!entity2.alive) {
                        continue;
                    }
                    const firstX = minX1 > entity2.cellMinX ? minX1 : entity2.cellMinX;
                    const firstY = minY1 > entity2.cellMinY ? minY1 : entity2.cellMinY;
                    const firstZ = minZ1 > entity2.cellMinZ ? minZ1 : entity2.cellMinZ;
                    if (firstX === cellX && firstY === cellY && firstZ === cellZ) {
                        callback(entity1, entity2);
                        count++;
                    }
                }
            }
        }
        return count;
    }
    get activity() {
        return this.activityVersion;
    }
    activitySince(cellsKeys, version) {
        for (const key of cellsKeys) {
            if (this.cellActivity[key] > version) {
                return true;
            }
        }
        return false;
    }
    clear(clean) {
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            if (cell && cell.count > 0) {
                cell.clear();
            }
        }
        if (clean) {
            for (const entity of clean.values()) {
                entity.cellsKeys[this.id].clear();
            }
        }
        this.totalEntitiesInCells = 0;
        this.entityCount = 0;
        return this;
    }
    get cellCount() {
        return this.cells.length;
    }
}
HashGrid3D.gridCount = 0;
class BaseCell {
    constructor(key) {
        this.key = key;
        this.count = 0;
    }
    add(cellsKeys) {
        cellsKeys?.add(this.key);
        this.count++;
    }
    delete(cellsKeys) {
        cellsKeys?.delete(this.key);
        this.count--;
    }
    clear() {
        this.count = 0;
    }
}
class UntypedCell extends BaseCell {
    constructor(key) {
        super(key);
        this.typed = false;
        this.objects = [];
    }
    insert(object, cellsKeys) {
        this.objects.push(object);
        this.add(cellsKeys);
    }
    remove(object, cellsKeys) {
        removeFromArray(this.objects, object);
        this.delete(cellsKeys);
    }
    clear() {
        this.objects.length = 0;
        super.clear();
    }
}
class TypedCell extends BaseCell {
    constructor(key, types) {
        super(key);
        this.typed = true;
        this.objects = {};
        this.queryCache = {};
        this.typed = true;
        for (const type in types) {
            this.objects[type] = [];
        }
    }
    insert(object, type, cellsKeys) {
        const array = this.objects[type];
        if (!array) {
            throw new Error(`Type ${String(type)} is not defined in this cell`);
        }
        array.push(object);
        this.add(cellsKeys);
    }
    remove(object, type, cellsKeys) {
        removeFromArray(this.objects[type], object);
        this.delete(cellsKeys);
    }
    clear() {
        for (const key in this.objects) {
            this.objects[key].length = 0;
        }
        super.clear();
    }
}
export { HashGrid3D as HashGrid };
