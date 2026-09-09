export class CounterMap {
    constructor(min = 0, max = Infinity) {
        this.map = new Map();
        this.min = min;
        this.max = max;
    }
    increment(key, amount = 1) {
        const current = this.getCount(key);
        const newValue = current + amount;
        this.map.set(key, newValue);
        return newValue;
    }
    decrement(key, amount = 1) {
        const current = this.getCount(key);
        const newValue = current - amount;
        if (newValue <= 0) {
            this.map.delete(key);
        }
        else {
            this.map.set(key, newValue);
        }
        return newValue;
    }
    delete(key) {
        return this.map.delete(key);
    }
    getCount(key) {
        return this.map.get(key) ?? 0;
    }
    has(key) {
        return this.map.has(key);
    }
    outOfBounds(key, min = this.min, max = this.max) {
        const count = this.getCount(key);
        return count < min || count > max;
    }
    clear() {
        this.map.clear();
    }
}
