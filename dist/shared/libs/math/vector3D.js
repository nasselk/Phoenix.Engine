import { clamp } from "./utils";
class Vector3D {
    constructor(a = 0, b = a, c = b, polar = false) {
        if (polar) {
            this.x = c * Math.cos(b) * Math.cos(a);
            this.y = c * Math.cos(b) * Math.sin(a);
            this.z = c * Math.sin(b);
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
        this.x += distance * Math.cos(elevation) * Math.cos(azimuth);
        this.y += distance * Math.cos(elevation) * Math.sin(azimuth);
        this.z += distance * Math.sin(elevation);
        return this;
    }
    interpolate(otherVec, t) {
        this.x += (otherVec.x - this.x) * t;
        this.y += (otherVec.y - this.y) * t;
        this.z += (otherVec.z - this.z) * t;
        return this;
    }
    setDirection(azimuth, elevation, distance) {
        this.x = distance * Math.cos(elevation) * Math.cos(azimuth);
        this.y = distance * Math.cos(elevation) * Math.sin(azimuth);
        this.z = distance * Math.sin(elevation);
        return this;
    }
    dot(vector) {
        return this.x * vector.x + this.y * vector.y + this.z * vector.z;
    }
    cross(vector) {
        return new Vector3D(this.y * vector.z - this.z * vector.y, this.z * vector.x - this.x * vector.z, this.x * vector.y - this.y * vector.x);
    }
    delta(vector) {
        return new Vector3D(vector.x - this.x, vector.y - this.y, vector.z - this.z);
    }
    midpoint(vector) {
        return new Vector3D((this.x + vector.x) / 2, (this.y + vector.y) / 2, (this.z + vector.z) / 2);
    }
    normalize() {
        if (this.isNull) {
            return this;
        }
        const magnitude = this.magnitude;
        return this.divide(magnitude);
    }
    rotate(angle, axis, point = Vector3D.NULL) {
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
        const dx = vector.x - this.x;
        const dy = vector.y - this.y;
        return Math.atan2(dy, dx);
    }
    elevationTo(vector) {
        const dx = vector.x - this.x;
        const dy = vector.y - this.y;
        const dz = vector.z - this.z;
        return Math.atan2(dz, Math.sqrt(dx ** 2 + dy ** 2));
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
        return new Vector3D(this.x, this.y, this.z);
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
        return Math.atan2(this.y, this.x);
    }
    set azimuth(value) {
        const planar = Math.sqrt(this.x ** 2 + this.y ** 2);
        this.x = planar * Math.cos(value);
        this.y = planar * Math.sin(value);
    }
    get elevation() {
        return Math.atan2(this.z, Math.sqrt(this.x ** 2 + this.y ** 2));
    }
    set elevation(value) {
        const magnitude = this.magnitude;
        const azimuth = this.azimuth;
        const planar = magnitude * Math.cos(value);
        this.x = planar * Math.cos(azimuth);
        this.y = planar * Math.sin(azimuth);
        this.z = magnitude * Math.sin(value);
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
Vector3D.NULL = Object.freeze(new Vector3D());
Vector3D.TEMP1 = new Vector3D();
Vector3D.TEMP2 = new Vector3D();
Vector3D.TEMP3 = new Vector3D();
Vector3D.TEMP4 = new Vector3D();
Vector3D.TEMP5 = new Vector3D();
class ObservableVector3D extends Vector3D {
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
export { Vector3D as Vector3, ObservableVector3D as ObservableVector3 };
