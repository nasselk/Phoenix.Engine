import { clamp } from "./utils.js";
class Vector2 {
    constructor(a = 0, b = a, polar = false) {
        if (polar) {
            this.x = b * Math.cos(a);
            this.y = b * Math.sin(a);
        }
        else {
            this.x = a;
            this.y = b;
        }
    }
    set(a, b) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x = a.x * scalar;
            this.y = a.y * scalar;
        }
        else {
            this.x = a;
            this.y = b ?? a;
        }
        return this;
    }
    add(a, b) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x += a.x * scalar;
            this.y += a.y * scalar;
        }
        else {
            this.x += a;
            this.y += b ?? a;
        }
        return this;
    }
    subtract(a, b) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x -= a.x * scalar;
            this.y -= a.y * scalar;
        }
        else {
            this.x -= a;
            this.y -= b ?? a;
        }
        return this;
    }
    multiply(a, b) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x *= a.x * scalar;
            this.y *= a.y * scalar;
        }
        else {
            this.x *= a;
            this.y *= b ?? a;
        }
        return this;
    }
    divide(a, b) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x /= a.x * scalar;
            this.y /= a.y * scalar;
        }
        else {
            if (a === 0) {
                throw new Error("Division by zero in vector division with x component");
            }
            else if (b === 0) {
                throw new Error("Division by zero in vector division with y component");
            }
            this.x /= a;
            this.y /= b ?? a;
        }
        return this;
    }
    scale(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }
    addDirection(angle, distance) {
        this.x += distance * Math.cos(angle);
        this.y += distance * Math.sin(angle);
        return this;
    }
    interpolate(otherVec, t) {
        this.x += (otherVec.x - this.x) * t;
        this.y += (otherVec.y - this.y) * t;
        return this;
    }
    setDirection(angle, distance) {
        this.x = distance * Math.cos(angle);
        this.y = distance * Math.sin(angle);
        return this;
    }
    dot(vector) {
        return this.x * vector.x + this.y * vector.y;
    }
    cross(vector) {
        return this.x * vector.y - this.y * vector.x;
    }
    delta(vector) {
        return new Vector2(vector.x - this.x, vector.y - this.y);
    }
    midpoint(vector) {
        return new Vector2((this.x + vector.x) / 2, (this.y + vector.y) / 2);
    }
    normalize() {
        if (this.isNull) {
            return this;
        }
        const magnitude = this.magnitude;
        return this.divide(magnitude);
    }
    rotate(angle, point = Vector2.NULL) {
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = dx * cos - dy * sin;
        const y = dx * sin + dy * cos;
        this.x = x + point.x;
        this.y = y + point.y;
        return this;
    }
    distance(vector) {
        const dx = this.x - vector.x;
        const dy = this.y - vector.y;
        return Math.sqrt(dx ** 2 + dy ** 2);
    }
    distanceSquared(vector) {
        const dx = this.x - vector.x;
        const dy = this.y - vector.y;
        return dx ** 2 + dy ** 2;
    }
    angleTo(vector) {
        const dx = vector.x - this.x;
        const dy = vector.y - this.y;
        return Math.atan2(dy, dx);
    }
    segmentDistance(p1, p2) {
        const projection = this.projectOnSegment(p1, p2);
        return this.distance(projection);
    }
    projectOnSegment(p1, p2) {
        const ab = p2.clone().subtract(p1);
        const t = clamp(this.clone().subtract(p1).dot(ab) / ab.magnitudeSquared, 0, 1);
        return p1.clone().add(ab.scale(t));
    }
    project(p) {
        const t = this.clone().dot(p) / p.magnitudeSquared;
        return p.clone().add(p.scale(t));
    }
    reflect(normal) {
        const dotProduct = this.dot(normal);
        return this.subtract(normal, 2 * dotProduct);
    }
    equals(a, b) {
        if (typeof a === "object") {
            return this.x === a.x && this.y === a.y;
        }
        else {
            b ?? (b = a);
            return this.x === a && this.y === b;
        }
    }
    toString() {
        return `Vector2(${this.x}, ${this.y})`;
    }
    clone() {
        return new Vector2(this.x, this.y);
    }
    get normal() {
        const vector = new Vector2(-this.y, this.x);
        return vector.normalize();
    }
    get magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }
    set magnitude(value) {
        const magnitude = this.magnitude;
        if (magnitude === 0) {
            throw new Error("Cannot set magnitude of a null vector");
        }
        const scale = value / magnitude;
        this.scale(scale);
    }
    get magnitudeSquared() {
        return this.x ** 2 + this.y ** 2;
    }
    get angle() {
        return Math.atan2(this.y, this.x);
    }
    set angle(value) {
        const magnitude = this.magnitude;
        this.x = magnitude * Math.cos(value);
        this.y = magnitude * Math.sin(value);
    }
    get isNull() {
        return this.x === 0 && this.y === 0;
    }
    get xy() {
        return [this.x, this.y];
    }
    set xy(value) {
        this.x = value[0];
        this.y = value[1];
    }
    get max() {
        return Math.max(this.x, this.y);
    }
    get min() {
        return Math.min(this.x, this.y);
    }
}
Vector2.NULL = Object.freeze(new Vector2());
Vector2.TEMP1 = new Vector2();
Vector2.TEMP2 = new Vector2();
Vector2.TEMP3 = new Vector2();
Vector2.TEMP4 = new Vector2();
Vector2.TEMP5 = new Vector2();
class ObservableVector2 extends Vector2 {
    constructor(a = 0, b = a, polar = false) {
        super(a, b, polar);
        this.storedX = this.x;
        this.storedY = this.y;
    }
    storeX() {
        this.storedX = this.x;
        return this;
    }
    storeY() {
        this.storedY = this.y;
        return this;
    }
    store(x = true, y = true) {
        if (x) {
            this.storeX();
        }
        if (y) {
            this.storeY();
        }
        return this;
    }
    hasUpdatedX(minimumDelta = 0) {
        return Math.abs(this.x - this.storedX) > minimumDelta;
    }
    hasUpdatedY(minimumDelta = 0) {
        return Math.abs(this.y - this.storedY) > minimumDelta;
    }
    hasUpdated(minimumDelta = 0) {
        if (this.hasUpdatedX(minimumDelta)) {
            return true;
        }
        else if (this.hasUpdatedY(minimumDelta)) {
            return true;
        }
        return false;
    }
}
export { Vector2, ObservableVector2 };
