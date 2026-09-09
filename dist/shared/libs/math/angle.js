import { randomFloat } from "./random.js";
export function randomAngle(min = 0, max = 2 * Math.PI, random = Math.random) {
    return randomFloat(min, max, random);
}
export function getAngleDistance(a, b) {
    const distance = Math.abs(normalizeAngle2PI(a - b));
    return Math.min(distance, 2 * Math.PI - distance);
}
export function normalizeAnglePI(angle) {
    const PI = Math.PI;
    const twoPI = 2 * PI;
    angle = ((((angle + PI) % twoPI) + twoPI) % twoPI) - PI;
    return angle;
}
export function normalizeAngle2PI(angle) {
    const twoPI = 2 * Math.PI;
    return ((angle % twoPI) + twoPI) % twoPI;
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
    let distance = getAngleDistance(reference, closest);
    for (let i = 1; i < angles.length; i++) {
        const newDistance = getAngleDistance(reference, angles[i]);
        if (newDistance < distance) {
            closest = angles[i];
            distance = newDistance;
        }
    }
    return closest;
}
