import { clamp } from "./utils";
class Vector3 {
    constructor(a = 0, b = a, c = b, polar = false) {
        if (polar) {
            this.x = c * Math.cos(b) * Math.sin(a);
            this.y = c * Math.sin(b);
            this.z = c * Math.cos(b) * Math.cos(a);
        }
        else {
            this.x = a;
            this.y = b;
            this.z = c;
        }
    }
    set(a, b, c) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x = a.x * scalar;
            this.y = a.y * scalar;
            this.z = a.z * scalar;
        }
        else {
            this.x = a;
            this.y = b ?? a;
            this.z = c ?? this.y;
        }
        return this;
    }
    add(a, b, c) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x += a.x * scalar;
            this.y += a.y * scalar;
            this.z += a.z * scalar;
        }
        else {
            const y = b ?? a;
            this.x += a;
            this.y += y;
            this.z += c ?? y;
        }
        return this;
    }
    subtract(a, b, c) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x -= a.x * scalar;
            this.y -= a.y * scalar;
            this.z -= a.z * scalar;
        }
        else {
            const y = b ?? a;
            this.x -= a;
            this.y -= y;
            this.z -= c ?? y;
        }
        return this;
    }
    multiply(a, b, c) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x *= a.x * scalar;
            this.y *= a.y * scalar;
            this.z *= a.z * scalar;
        }
        else {
            const y = b ?? a;
            this.x *= a;
            this.y *= y;
            this.z *= c ?? y;
        }
        return this;
    }
    divide(a, b, c) {
        if (typeof a === "object") {
            const scalar = b ?? 1;
            this.x /= a.x * scalar;
            this.y /= a.y * scalar;
            this.z /= a.z * scalar;
        }
        else {
            if (a === 0) {
                throw new Error("Division by zero in vector division with x component");
            }
            else if (b === 0) {
                throw new Error("Division by zero in vector division with y component");
            }
            else if (c === 0) {
                throw new Error("Division by zero in vector division with z component");
            }
            const y = b ?? a;
            this.x /= a;
            this.y /= y;
            this.z /= c ?? y;
        }
        return this;
    }
    scale(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }
    addDirection(azimuth, elevation, distance) {
        this.x += distance * Math.cos(elevation) * Math.sin(azimuth);
        this.y += distance * Math.sin(elevation);
        this.z += distance * Math.cos(elevation) * Math.cos(azimuth);
        return this;
    }
    interpolate(target, t) {
        this.x += (target.x - this.x) * t;
        this.y += (target.y - this.y) * t;
        this.z += (target.z - this.z) * t;
        return this;
    }
    setDirection(azimuth, elevation, distance) {
        this.x = distance * Math.cos(elevation) * Math.sin(azimuth);
        this.y = distance * Math.sin(elevation);
        this.z = distance * Math.cos(elevation) * Math.cos(azimuth);
        return this;
    }
    dot(vector) {
        return this.x * vector.x + this.y * vector.y + this.z * vector.z;
    }
    cross(vector, out = new Vector3()) {
        return out.set(this.y * vector.z - this.z * vector.y, this.z * vector.x - this.x * vector.z, this.x * vector.y - this.y * vector.x);
    }
    delta(vector, out = new Vector3()) {
        return out.set(this.x - vector.x, this.y - vector.y, this.z - vector.z);
    }
    midpoint(vector, out = new Vector3()) {
        return out.set((this.x + vector.x) / 2, (this.y + vector.y) / 2, (this.z + vector.z) / 2);
    }
    normalize() {
        if (this.isNull) {
            return this;
        }
        const magnitude = this.magnitude;
        return this.divide(magnitude);
    }
    rotate(angle, axis, point = Vector3.NULL) {
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        const dz = this.z - point.z;
        const length = Math.sqrt(axis.x ** 2 + axis.y ** 2 + axis.z ** 2);
        if (length === 0) {
            return this;
        }
        const kx = axis.x / length;
        const ky = axis.y / length;
        const kz = axis.z / length;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dot = kx * dx + ky * dy + kz * dz;
        const x = dx * cos + (ky * dz - kz * dy) * sin + kx * dot * (1 - cos);
        const y = dy * cos + (kz * dx - kx * dz) * sin + ky * dot * (1 - cos);
        const z = dz * cos + (kx * dy - ky * dx) * sin + kz * dot * (1 - cos);
        this.x = x + point.x;
        this.y = y + point.y;
        this.z = z + point.z;
        return this;
    }
    distance(vector) {
        const dx = this.x - vector.x;
        const dy = this.y - vector.y;
        const dz = this.z - vector.z;
        return Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
    }
    distanceSquared(vector) {
        const dx = this.x - vector.x;
        const dy = this.y - vector.y;
        const dz = this.z - vector.z;
        return dx ** 2 + dy ** 2 + dz ** 2;
    }
    azimuthTo(vector) {
        return Math.atan2(vector.x - this.x, vector.z - this.z);
    }
    elevationTo(vector) {
        const dx = vector.x - this.x;
        const dy = vector.y - this.y;
        const dz = vector.z - this.z;
        return Math.atan2(dy, Math.sqrt(dx ** 2 + dz ** 2));
    }
    segmentDistance(p1, p2) {
        return Math.sqrt(this.distanceSquared(this.projectOnSegment(p1, p2, Vector3.SCRATCH)));
    }
    projectOnSegment(p1, p2, out = new Vector3()) {
        const abx = p2.x - p1.x;
        const aby = p2.y - p1.y;
        const abz = p2.z - p1.z;
        const lengthSquared = abx ** 2 + aby ** 2 + abz ** 2;
        const t = lengthSquared === 0 ? 0 : clamp(((this.x - p1.x) * abx + (this.y - p1.y) * aby + (this.z - p1.z) * abz) / lengthSquared, 0, 1);
        return out.set(p1.x + abx * t, p1.y + aby * t, p1.z + abz * t);
    }
    project(direction, out = new Vector3()) {
        const lengthSquared = direction.x ** 2 + direction.y ** 2 + direction.z ** 2;
        const t = lengthSquared === 0 ? 0 : this.dot(direction) / lengthSquared;
        return out.set(direction.x * t, direction.y * t, direction.z * t);
    }
    reflect(normal) {
        const dotProduct = this.dot(normal);
        return this.subtract(normal, 2 * dotProduct);
    }
    equals(a, b, c) {
        if (typeof a === "object") {
            return this.x === a.x && this.y === a.y && this.z === a.z;
        }
        else {
            b ?? (b = a);
            c ?? (c = b);
            return this.x === a && this.y === b && this.z === c;
        }
    }
    toString() {
        return `Vector3(${this.x}, ${this.y}, ${this.z})`;
    }
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }
    get magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
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
        return this.x ** 2 + this.y ** 2 + this.z ** 2;
    }
    get azimuth() {
        return Math.atan2(this.x, this.z);
    }
    set azimuth(value) {
        const planar = Math.sqrt(this.x ** 2 + this.z ** 2);
        this.x = planar * Math.sin(value);
        this.z = planar * Math.cos(value);
    }
    get elevation() {
        return Math.atan2(this.y, Math.sqrt(this.x ** 2 + this.z ** 2));
    }
    set elevation(value) {
        const magnitude = this.magnitude;
        const azimuth = this.azimuth;
        const planar = magnitude * Math.cos(value);
        this.x = planar * Math.sin(azimuth);
        this.y = magnitude * Math.sin(value);
        this.z = planar * Math.cos(azimuth);
    }
    get isNull() {
        return this.x === 0 && this.y === 0 && this.z === 0;
    }
    get xyz() {
        return [this.x, this.y, this.z];
    }
    set xyz(value) {
        this.x = value[0];
        this.y = value[1];
        this.z = value[2];
    }
    get max() {
        return Math.max(this.x, this.y, this.z);
    }
    get min() {
        return Math.min(this.x, this.y, this.z);
    }
}
Vector3.NULL = Object.freeze(new Vector3());
Vector3.TEMP1 = new Vector3();
Vector3.TEMP2 = new Vector3();
Vector3.TEMP3 = new Vector3();
Vector3.TEMP4 = new Vector3();
Vector3.TEMP5 = new Vector3();
Vector3.SCRATCH = new Vector3();
class ObservableVector3 extends Vector3 {
    constructor(a = 0, b = a, c = b, polar = false) {
        super(a, b, c, polar);
        this.storedX = this.x;
        this.storedY = this.y;
        this.storedZ = this.z;
    }
    storeX() {
        this.storedX = this.x;
        return this;
    }
    storeY() {
        this.storedY = this.y;
        return this;
    }
    storeZ() {
        this.storedZ = this.z;
        return this;
    }
    store(x = true, y = true, z = true) {
        if (x) {
            this.storeX();
        }
        if (y) {
            this.storeY();
        }
        if (z) {
            this.storeZ();
        }
        return this;
    }
    hasUpdatedX(minimumDelta = 0) {
        return Math.abs(this.x - this.storedX) > minimumDelta;
    }
    hasUpdatedY(minimumDelta = 0) {
        return Math.abs(this.y - this.storedY) > minimumDelta;
    }
    hasUpdatedZ(minimumDelta = 0) {
        return Math.abs(this.z - this.storedZ) > minimumDelta;
    }
    hasUpdated(minimumDelta = 0) {
        if (this.hasUpdatedX(minimumDelta)) {
            return true;
        }
        else if (this.hasUpdatedY(minimumDelta)) {
            return true;
        }
        else if (this.hasUpdatedZ(minimumDelta)) {
            return true;
        }
        return false;
    }
}
export { Vector3, ObservableVector3 };
