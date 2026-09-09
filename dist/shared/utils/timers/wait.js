import { Timeout } from "./timer.js";
export function wait(timeout, customLoop = false) {
    return new Promise((resolve) => new Timeout(resolve, timeout, customLoop));
}
