import { Updates } from "./updates.js";

const TYPE_OFFSET = 65535; // Max Uint16 to dont interfer with other data (kind of a hack)

export function getUpdateEncoder(type: keyof typeof Updates): number {
	const encoder = Updates[type];

	if (encoder === undefined) {
		throw new Error(`Invalid updates decoder: ${type}`);
	} else {
		return TYPE_OFFSET - encoder;
	}
}

export function getUpdateDecoder(encoder: number, strict: boolean = true): keyof typeof Updates {
	const type = Updates[TYPE_OFFSET - encoder];

	if (strict && !type) {
		throw new Error(`Invalid updates encoder: ${TYPE_OFFSET - encoder}`);
	} else {
		return type as keyof typeof Updates;
	}
}
