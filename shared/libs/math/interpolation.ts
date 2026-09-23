import { extractRGBA } from "../../utils/color";

import { normalizeAnglePI } from "./angle";

const view = (globalThis as any).document; // Check if running in a browser environment

export const enum InterpolationCurve {
	LINEAR,
	EASE_IN,
	EASE_OUT,
	EASE_IN_OUT,
}

type InterpolationFunction = (f: number) => number;

const curves: InterpolationFunction[] = [];

// Define interpolation curves
curves[InterpolationCurve.LINEAR] = (f: number) => f;
curves[InterpolationCurve.EASE_IN] = (f: number) => f * f;
curves[InterpolationCurve.EASE_OUT] = (f: number) => f * (2 - f);
curves[InterpolationCurve.EASE_IN_OUT] = (f: number) => (f < 0.5 ? 2 * f * f : -1 + (4 - 2 * f) * f);

function applyCurve(f: number, curve: InterpolationCurve = InterpolationCurve.LINEAR): number {
	return curves[curve](f);
}

function lerp(start: number, end: number, factor: number, deltaTime: number = 1, limit: number = 0): number {
	const delta = end - start;

	if (Math.abs(delta) < limit || view?.hidden) {
		return end;
	}

	const f = 1 - Math.pow(1 - factor, deltaTime);

	return start + delta * f;
}

function lerpAngle(start: number, end: number, factor: number, deltaTime?: number, limit?: number): number {
	const delta = normalizeAnglePI(end - start);

	return lerp(start, start + delta, factor, deltaTime, limit);
}

function lerpColor(start: string, end: string, factor: number = 0.05, deltaTime: number = 1, limit: number = 0): string {
	const startChannels = extractRGBA(start);
	const endChannels = extractRGBA(end);

	const r = lerp(startChannels?.r ?? 0, endChannels?.r ?? 0, factor, deltaTime, limit);
	const g = lerp(startChannels?.g ?? 0, endChannels?.g ?? 0, factor, deltaTime, limit);
	const b = lerp(startChannels?.b ?? 0, endChannels?.b ?? 0, factor, deltaTime, limit);
	const a = lerp(startChannels?.a ?? 1, endChannels?.a ?? 1, factor, deltaTime, limit);

	return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

function clampedLerp(start: number, end: number, t: number, startT: number, endT: number) {
	if (t < startT) return start;
	if (t > endT) return end;

	const factor = (t - startT) / (endT - startT);

	return lerp(start, end, factor);
}

function tween(start: number, end: number, duration: number, elapsed: number, curve?: InterpolationCurve): number {
	if (elapsed >= duration) {
		return end;
	}

	const delta = end - start;
	const f = elapsed / duration;
	const curvedF = applyCurve(f, curve);

	return start + delta * curvedF;
}

function tweenAngle(start: number, end: number, duration: number, elapsed: number, curve?: InterpolationCurve): number {
	const delta = normalizeAnglePI(end - start);

	return tween(start, start + delta, duration, elapsed, curve);
}

function tweenColor(start: string, end: string, duration: number, elapsed: number, curve?: InterpolationCurve): string {
	if (elapsed >= duration) {
		return end;
	}

	const startChannels = extractRGBA(start);
	const endChannels = extractRGBA(end);

	const r = tween(startChannels?.r ?? 0, endChannels?.r ?? 0, duration, elapsed, curve);
	const g = tween(startChannels?.g ?? 0, endChannels?.g ?? 0, duration, elapsed, curve);
	const b = tween(startChannels?.b ?? 0, endChannels?.b ?? 0, duration, elapsed, curve);
	const a = tween(startChannels?.a ?? 1, endChannels?.a ?? 1, duration, elapsed, curve);

	return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

export const Interpolator = {
	lerp,
	lerpAngle,
	lerpColor,
	clampedLerp,
	tween,
	tweenAngle,
	tweenColor,
};

export default Interpolator;
