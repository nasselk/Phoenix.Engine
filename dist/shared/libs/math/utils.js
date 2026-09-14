import { Vector } from "./vector.js";
export const EPSILON = 1e-10;
export function clamp(value, minimum, maximum) {
    if (minimum > maximum) {
        throw new RangeError("Invalid range");
    }
    return Math.min(Math.max(value, minimum), maximum);
}
export function wrap(value, minimum, maximum) {
    if (minimum > maximum) {
        throw new RangeError("Invalid range");
    }
    const range = maximum - minimum;
    return ((((value - minimum) % range) + range) % range) + minimum;
}
export function sign(value) {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
}
export function percentage(value, max = 100, round = true) {
    const result = (value / max) * 100;
    return round ? Math.round(result) : result;
}
export function normalizeArray(array) {
    let total = 0;
    for (let i = 0; i < array.length; i++) {
        total += array[i];
    }
    if (total === 0) {
        throw new RangeError("Normalized elements sum to zero!");
    }
    for (let i = 0; i < array.length; i++) {
        array[i] /= total;
    }
    return array;
}
export function getBoundingBox(width, height, angle = 0) {
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    return new Vector(width * cos + height * sin, width * sin + height * cos);
}
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx ** 2 + dy ** 2);
}
export function distanceSquared(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx ** 2 + dy ** 2;
}
