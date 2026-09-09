import { Vector } from "./vector.js";
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
export function randomCirclePoint(position, radius, innerRadius = 0, random = Math.random) {
    const angle = random() * 2 * Math.PI;
    const distance = innerRadius + Math.sqrt(random()) * (radius - innerRadius);
    return new Vector(angle, distance, true).add(position);
}
export function randomTrianglePoint(p1, p2, p3, random = Math.random) {
    const random1 = random();
    const random2 = random();
    const sqrt = Math.sqrt(random1);
    const x = (1 - sqrt) * p1.x + sqrt * (1 - random2) * p2.x + sqrt * random2 * p3.x;
    const y = (1 - sqrt) * p1.y + sqrt * (1 - random2) * p2.y + sqrt * random2 * p3.y;
    return new Vector(x, y);
}
