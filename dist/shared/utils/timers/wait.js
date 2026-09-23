import { Timeout } from "./timer";
export function wait(timeout, customLoop = false) {
    return new Promise((resolve) => new Timeout(resolve, timeout, customLoop));
}
