export function wave(min: number, max: number, speed: number = 1, now: number = performance.now()): number {
	if (min > max) {
		throw new RangeError("Invalid range");
	}

	const midpoint = (min + max) / 2;
	const amplitude = (max - min) / 2;

	return midpoint + amplitude * Math.sin(now / ((1 / speed) * 1000));
}

export function syncedWave(min: number, max: number, index: number, maxIndex: number, speed: number = 1, now: number = performance.now(), allowNegative: boolean = false): number {
	if (min > max && !allowNegative) {
		throw new RangeError("Invalid range");
	}

	const midpoint = (min + max) / 2;
	const amplitude = (max - min) / 2;

	return midpoint + amplitude * Math.sin(now / ((1 / speed) * 1000) + (index / maxIndex) * Math.PI * 2);
}

// returns a linear + sine wave function that passes through (0, start), (0.5, middle), (1, end)
export function pointsSyncedWave(start: number, middle: number, end: number): (t: number) => number {
	const pi: number = Math.PI;

	const temp1: number = (start - end) / (2 - pi);

	const b: number = pi * temp1;
	const c: number = end + (1 - pi) * temp1;

	const temp2: number = middle - b / 2 - c;

	const a: number = Math.sqrt(temp1 ** 2 + temp2 ** 2);
	const phi: number = Math.asin((temp1 * 1) / a);

	// Returns a function so we don't redo the expensive asin and sqrt calculations
	return (t: number): number => {
		return a * Math.sin(pi * t + phi) + b * t + c;
	};
}

// helper function that allows you to specify a fadeInTime, fadeOutTime, and totalTime, and linearly interpolates between them in a /‾\ shape
export function fadeInHoldAndFadeOut(time: number, fadeInTime: number, fadeOutTime: number, totalTime: number = fadeInTime + fadeOutTime, min: number = 0, max: number = 1) {
	const holdTime = totalTime - fadeInTime - fadeOutTime;

	let t: number;
	if (time < fadeInTime) {
		t = Math.max(0, time / fadeInTime);
	} else if (time < fadeInTime + holdTime) {
		t = 1;
	} else {
		t = Math.max(0, 1 - (time - fadeInTime - holdTime) / fadeOutTime);
	}

	return (1 - t) * min + t * max;
}
