export function wave(min, max, speed = 1, now = performance.now()) {
    if (min > max) {
        throw new RangeError("Invalid range");
    }
    const midpoint = (min + max) / 2;
    const amplitude = (max - min) / 2;
    return midpoint + amplitude * Math.sin(now / ((1 / speed) * 1000));
}
export function syncedWave(min, max, index, maxIndex, speed = 1, now = performance.now(), allowNegative = false) {
    if (min > max && !allowNegative) {
        throw new RangeError("Invalid range");
    }
    const midpoint = (min + max) / 2;
    const amplitude = (max - min) / 2;
    return midpoint + amplitude * Math.sin(now / ((1 / speed) * 1000) + (index / maxIndex) * Math.PI * 2);
}
export function pointsSyncedWave(start, middle, end) {
    const pi = Math.PI;
    const temp1 = (start - end) / (2 - pi);
    const b = pi * temp1;
    const c = end + (1 - pi) * temp1;
    const temp2 = middle - b / 2 - c;
    const a = Math.sqrt(temp1 ** 2 + temp2 ** 2);
    const phi = Math.asin((temp1 * 1) / a);
    return (t) => {
        return a * Math.sin(pi * t + phi) + b * t + c;
    };
}
export function fadeInHoldAndFadeOut(time, fadeInTime, fadeOutTime, totalTime = fadeInTime + fadeOutTime, min = 0, max = 1) {
    const holdTime = totalTime - fadeInTime - fadeOutTime;
    let t;
    if (time < fadeInTime) {
        t = Math.max(0, time / fadeInTime);
    }
    else if (time < fadeInTime + holdTime) {
        t = 1;
    }
    else {
        t = Math.max(0, 1 - (time - fadeInTime - holdTime) / fadeOutTime);
    }
    return (1 - t) * min + t * max;
}
