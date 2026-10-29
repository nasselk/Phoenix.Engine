export class IDAllocator {
    constructor() {
        this.positiveIDsPool = [];
        this.negativeIDsPool = [];
        this.nextPositiveID = 1;
        this.nextNegativeID = -1;
        this.timedIDs = [];
        this.timedFreeAt = [];
        this.timedHead = 0;
    }
    allocate() {
        if (this.positiveIDsPool.length > 0) {
            return this.positiveIDsPool.pop();
        }
        else {
            return this.nextPositiveID++;
        }
    }
    allocateNegative() {
        if (this.negativeIDsPool.length > 0) {
            return this.negativeIDsPool.pop();
        }
        else {
            return this.nextNegativeID--;
        }
    }
    reserve(id) {
        if (!Number.isInteger(id) || id === 0) {
            return false;
        }
        const positive = id > 0;
        const pool = positive ? this.positiveIDsPool : this.negativeIDsPool;
        const next = positive ? this.nextPositiveID : this.nextNegativeID;
        if (positive ? id >= next : id <= next) {
            for (let skipped = next; skipped !== id; skipped += positive ? 1 : -1) {
                pool.push(skipped);
            }
            if (positive) {
                this.nextPositiveID = id + 1;
            }
            else {
                this.nextNegativeID = id - 1;
            }
            return true;
        }
        const index = pool.indexOf(id);
        if (index === -1) {
            return false;
        }
        pool.splice(index, 1);
        return true;
    }
    free(...ids) {
        for (const id of ids) {
            if (id > 0) {
                if (id < this.nextPositiveID) {
                    this.positiveIDsPool.push(id);
                }
            }
            else {
                if (id > this.nextNegativeID) {
                    this.negativeIDsPool.push(id);
                }
            }
        }
        return this;
    }
    freeWithTimeout(id, delay = 2500, now = performance.now()) {
        this.timedIDs.push(id);
        this.timedFreeAt.push(now + delay);
        return this;
    }
    processTimeouts(now = performance.now()) {
        const ids = this.timedIDs;
        const freeAt = this.timedFreeAt;
        let head = this.timedHead;
        while (head < ids.length && freeAt[head] <= now) {
            this.free(ids[head]);
            head++;
        }
        this.timedHead = head;
        if (head > 1024 && head * 2 >= ids.length) {
            ids.splice(0, head);
            freeAt.splice(0, head);
            this.timedHead = 0;
        }
        return this;
    }
    get pendingTimeouts() {
        return this.timedIDs.length - this.timedHead;
    }
    clear() {
        this.positiveIDsPool.length = 0;
        this.negativeIDsPool.length = 0;
        this.nextPositiveID = 1;
        this.nextNegativeID = -1;
        this.timedIDs.length = 0;
        this.timedFreeAt.length = 0;
        this.timedHead = 0;
        return this;
    }
}
//# sourceMappingURL=IDAllocator.js.map