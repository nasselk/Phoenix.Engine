import { randomFloat } from "./random";
import { wrap } from "./utils";
export function randomAngle(min = 0, max = 2 * Math.PI, random = Math.random) {
    return randomFloat(min, max, random);
}
export function angleDistance(a, b) {
    const distance = Math.abs(normalizeAngle2PI(a - b));
    return Math.min(distance, 2 * Math.PI - distance);
}
export function normalizeAnglePI(angle) {
    return wrap(angle, -Math.PI, Math.PI);
}
export function normalizeAngle2PI(angle) {
    return wrap(angle, 0, 2 * Math.PI);
}
export function signedAngleDistance(angle1, angle2) {
    const twoPI = 2 * Math.PI;
    const dif = (angle2 - angle1) % twoPI;
    return ((2 * dif) % twoPI) - dif;
}
export function getOppositeAngle(angle) {
    return (angle + Math.PI) % (2 * Math.PI);
}
export function degreesToRadians(degrees) {
    const radians = degrees * (Math.PI / 180);
    return radians;
}
export function radiansToDegrees(radians) {
    const degrees = radians * (180 / Math.PI);
    return degrees;
}
export function closestAngle(reference, ...angles) {
    reference = normalizeAngle2PI(reference);
    let closest = angles[0];
    let distance = angleDistance(reference, closest);
    for (let i = 1; i < angles.length; i++) {
        const newDistance = angleDistance(reference, angles[i]);
        if (newDistance < distance) {
            closest = angles[i];
            distance = newDistance;
        }
    }
    return closest;
}
