import { Timeout } from "./timer.js";

export function wait(timeout: number, customLoop: boolean = false): Promise<void> {
	return new Promise((resolve) => new Timeout(resolve, timeout, customLoop));
}
