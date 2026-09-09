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
