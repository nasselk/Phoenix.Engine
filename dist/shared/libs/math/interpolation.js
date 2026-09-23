import { extractRGBA } from "../../utils/color";
import { normalizeAnglePI } from "./angle";
const view = globalThis.document;
const curves = [];
curves[0] = (f) => f;
curves[1] = (f) => f * f;
curves[2] = (f) => f * (2 - f);
curves[3] = (f) => (f < 0.5 ? 2 * f * f : -1 + (4 - 2 * f) * f);
function applyCurve(f, curve = 0) {
    return curves[curve](f);
}
function lerp(start, end, factor, deltaTime = 1, limit = 0) {
    const delta = end - start;
    if (Math.abs(delta) < limit || view?.hidden) {
        return end;
    }
    const f = 1 - Math.pow(1 - factor, deltaTime);
    return start + delta * f;
}
function lerpAngle(start, end, factor, deltaTime, limit) {
    const delta = normalizeAnglePI(end - start);
    return lerp(start, start + delta, factor, deltaTime, limit);
}
function lerpColor(start, end, factor = 0.05, deltaTime = 1, limit = 0) {
    const startChannels = extractRGBA(start);
    const endChannels = extractRGBA(end);
    const r = lerp(startChannels?.r ?? 0, endChannels?.r ?? 0, factor, deltaTime, limit);
    const g = lerp(startChannels?.g ?? 0, endChannels?.g ?? 0, factor, deltaTime, limit);
    const b = lerp(startChannels?.b ?? 0, endChannels?.b ?? 0, factor, deltaTime, limit);
    const a = lerp(startChannels?.a ?? 1, endChannels?.a ?? 1, factor, deltaTime, limit);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}
function clampedLerp(start, end, t, startT, endT) {
    if (t < startT)
        return start;
    if (t > endT)
        return end;
    const factor = (t - startT) / (endT - startT);
    return lerp(start, end, factor);
}
function tween(start, end, duration, elapsed, curve) {
    if (elapsed >= duration) {
        return end;
    }
    const delta = end - start;
    const f = elapsed / duration;
    const curvedF = applyCurve(f, curve);
    return start + delta * curvedF;
}
function tweenAngle(start, end, duration, elapsed, curve) {
    const delta = normalizeAnglePI(end - start);
    return tween(start, start + delta, duration, elapsed, curve);
}
function tweenColor(start, end, duration, elapsed, curve) {
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
