export function randomBoolean(w1 = 0.5, w2 = 0.5) {
    return weightedRandom(w1, w2) === 0;
}
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
export function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}
export function weightedRandom(...weights) {
    if (weights.length === 0) {
        throw new RangeError("At least one weight must be provided");
    }
    let total = 0;
    for (const weight of weights) {
        if (weight < 0) {
            throw new RangeError("Weights must be positive numbers");
        }
        total += weight;
    }
    const value = Math.random() * total;
    let accumulator = 0;
    for (let i = 0; i < weights.length; i++) {
        accumulator += weights[i];
        if (value < accumulator) {
            return i;
        }
    }
    return weights.length - 1;
}
