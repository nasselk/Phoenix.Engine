import { createBuffer } from "@nasselk/binarypack";
export class BitSet {
    constructor(allocation = 0, resizable = allocation === 0, clone = false) {
        this.resizable = resizable;
        this.size = 0;
        if (typeof allocation === "number") {
            this.bits = createBuffer(Math.ceil(allocation / 8));
        }
        else if (Array.isArray(allocation) || allocation instanceof Set) {
            const max = Math.max(0, ...allocation);
            this.bits = createBuffer(Math.ceil((max + 1) / 8));
            for (const value of allocation) {
                this.add(value);
            }
        }
        else {
            this.bits = createBuffer(allocation, clone);
        }
        this.length = this.bits.byteLength * 8;
    }
    [Symbol.iterator]() {
        const bits = this.bits;
        const length = bits.length;
        let byteIndex = 0;
        let bitIndex = 0;
        return {
            [Symbol.iterator]() {
                return this;
            },
            next() {
                while (byteIndex < length) {
                    const byte = bits[byteIndex];
                    if (byte) {
                        while (bitIndex < 8) {
                            if (byte & (1 << bitIndex)) {
                                const value = (byteIndex << 3) + bitIndex;
                                bitIndex++;
                                return { done: false, value };
                            }
                            bitIndex++;
                        }
                    }
                    byteIndex++;
                    bitIndex = 0;
                }
                return { done: true, value: undefined };
            },
        };
    }
    forEach(callback) {
        let i = 0;
        for (const value of this) {
            callback(value, i);
            i++;
        }
    }
    add(value) {
        const index = value >> 3;
        const bit = value & 7;
        if (this.resizable && index >= this.bits.length) {
            this.resize(value);
        }
        this.bits[index] |= 1 << bit;
        this.size++;
    }
    has(value) {
        const index = value >> 3;
        const bit = value & 7;
        if (index >= this.bits.length) {
            return false;
        }
        const has = this.bits[index] & (1 << bit);
        return !!has;
    }
    hasAndAdd(value) {
        const index = value >> 3;
        const bit = value & 7;
        if (this.resizable && index >= this.bits.length) {
            this.resize(value);
        }
        const mask = 1 << bit;
        const has = this.bits[index] & mask;
        if (!has) {
            this.bits[index] |= mask;
            this.size++;
        }
        return !!has;
    }
    flip(value) {
        const index = value >> 3;
        const bit = value & 7;
        const mask = 1 << bit;
        if (this.resizable && index >= this.bits.length) {
            this.resize(value);
        }
        const had = this.bits[index] & mask;
        if (had) {
            this.bits[index] &= ~mask;
            this.size--;
        }
        else {
            this.bits[index] |= mask;
            this.size++;
        }
        return !!had;
    }
    delete(value) {
        const index = value >> 3;
        if (index < this.bits.length) {
            const bit = value & 7;
            this.bits[index] &= ~(1 << bit);
            this.size--;
        }
    }
    resize(max, restore = true) {
        const bits = createBuffer(Math.ceil((max + 1) / 8), !restore);
        this.length = bits.byteLength * 8;
        if (restore) {
            for (let i = 0; i < bits.length; i++) {
                if (i < this.bits.length) {
                    bits[i] = this.bits[i];
                }
                else {
                    bits[i] = 0;
                }
            }
        }
        else {
            this.size = 0;
        }
        this.bits = bits;
        return this;
    }
    clear() {
        this.bits.fill(0);
        this.size = 0;
        return this;
    }
    toString() {
        const values = [];
        for (const value of this) {
            values.push(value);
        }
        return `{ ${values.join(", ")} }`;
    }
    get isEmpty() {
        return this.size === 0;
    }
}
