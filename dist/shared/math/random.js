export function randomInt(min, max, random = Math.random) {
    if (min > max) {
        throw new RangeError("Invalid range");
    }
    return Math.floor(random() * (max - min + 1) + min);
}
export function randomFloat(min = 0, max = 1, random = Math.random) {
    if (min > max) {
        throw new RangeError("Invalid range");
    }
    return random() * (max - min) + min;
}
export function randomAngle(min = 0, max = 2 * Math.PI, random = Math.random) {
    return randomFloat(min, max, random);
}
export function randomElement(array, random = Math.random) {
    return array[Math.floor(random() * array.length)];
}
export function randomBoolean(w1 = 0.5, w2 = 0.5, random = Math.random) {
    return weightedRandom([w1, w2], random) === 0;
}
export function weightedRandom(weights, random = Math.random) {
    if (weights.length === 0) {
        throw new RangeError("At least one weight must be provided");
    }
    let total = 0;
    for (const weight of weights) {
        if (weight < 0) {
            throw new RangeError("Weights must not be negative");
        }
        total += weight;
    }
    if (total === 0) {
        throw new RangeError("At least one weight must be above zero");
    }
    const value = random() * total;
    let accumulator = 0;
    for (let i = 0; i < weights.length; i++) {
        accumulator += weights[i];
        if (value < accumulator) {
            return i;
        }
    }
    return weights.findLastIndex((weight) => weight > 0);
}
export class RNG {
    constructor(seed) {
        this.seed = seed;
    }
    random() {
        const a = 1664525;
        const c = 1013904223;
        const m = 2 ** 32;
        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    }
}
