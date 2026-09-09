import { randomInt } from "../libs/math/random.js";
export function removeFromArray(array, item, index) {
    if (index !== undefined) {
        const last = array.pop();
        if (index < array.length) {
            array[index] = last;
            return last;
        }
    }
    else {
        for (let i = 0; i < array.length; i++) {
            if (array[i] === item) {
                const last = array.pop();
                if (i < array.length) {
                    array[i] = last;
                    return last;
                }
                break;
            }
        }
    }
}
export function randomValue(...params) {
    if (Array.isArray(params[0])) {
        const array = params[0];
        const random = params[1];
        const index = randomInt(0, array.length - 1, random);
        return array[index];
    }
    else {
        const index = randomInt(0, params.length - 1);
        return params[index];
    }
}
export function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        const s = source[key];
        const t = target[key];
        if (s !== null && typeof s === "object" && !Array.isArray(s) && t !== null && typeof t === "object" && !Array.isArray(t)) {
            deepMerge(t, s);
        }
        else if (s !== null && typeof s === "object") {
            target[key] = structuredClone(s);
        }
        else {
            target[key] = s;
        }
    }
    return target;
}
export function deepCopy(source) {
    if (source === null || typeof source !== "object")
        return source;
    if (Array.isArray(source))
        return source.map((item) => deepCopy(item));
    const target = {};
    for (const key in source) {
        const value = source[key];
        target[key] = value !== null && typeof value === "object" ? deepCopy(value) : value;
    }
    return target;
}
