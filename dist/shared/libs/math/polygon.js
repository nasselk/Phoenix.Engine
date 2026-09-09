import { Vector } from "./vector.js";
import { EPSILON } from "./utils.js";
import earcut from "earcut";
export class Polygon {
    constructor(a, b, c, d, e, f) {
        this._minX = Infinity;
        this._minY = Infinity;
        this._maxX = -Infinity;
        this._maxY = -Infinity;
        this._boundsDirty = true;
        this.triangles = [];
        if (Array.isArray(a)) {
            this.points = a;
            this.init(b, c);
        }
        else {
            this.points = [];
            this.fromRectangle(a, b, c, d);
            this.init(e, f);
        }
    }
    *[Symbol.iterator]() {
        for (const point of this.points) {
            yield point;
        }
    }
    forEach(callback) {
        let i = 0;
        for (const value of this) {
            callback(value, i);
            i++;
        }
    }
    static union(...polygons) {
        const allPoints = [];
        polygons.forEach((poly) => allPoints.push(...poly.points));
        if (allPoints.length === 0) {
            return new Polygon([]);
        }
        let start = allPoints[0];
        for (const p of allPoints) {
            if (p.y < start.y || (p.y === start.y && p.x < start.x)) {
                start = p;
            }
        }
        const sorted = allPoints.slice();
        sorted.sort((a, b) => {
            const angleA = Math.atan2(a.y - start.y, a.x - start.x);
            const angleB = Math.atan2(b.y - start.y, b.x - start.x);
            return angleA - angleB;
        });
        const hull = [];
        for (const pt of sorted) {
            while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], pt) <= 0) {
                hull.pop();
            }
            hull.push(pt);
        }
        return new Polygon(hull);
    }
    init(offset = 0, scale = 1) {
        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            this.points[i] = new Vector(offset + point.x * scale, offset + point.y * scale);
        }
        this.triangulate();
    }
    triangulate() {
        if (this.points.length > 3) {
            const points = [];
            for (const point of this.points) {
                points.push(point.x, point.y);
            }
            const result = earcut(points);
            this.triangles.length = 0;
            for (let i = 0; i < result.length; i += 3) {
                const p1 = this.points[result[i]];
                const p2 = this.points[result[i + 1]];
                const p3 = this.points[result[i + 2]];
                const polygon = new Polygon([p1, p2, p3]);
                this.triangles.push(polygon);
            }
            return this.triangles;
        }
    }
    fromRectangle(x = 0, y = 0, width = 0, height = 0) {
        this.points.push(new Vector(x - width / 2, y - height / 2), new Vector(x + width / 2, y - height / 2), new Vector(x + width / 2, y + height / 2), new Vector(x - width / 2, y + height / 2));
    }
    set(points) {
        this.points.length = 0;
        this.points.push(...points);
        this._boundsDirty = true;
        return this;
    }
    add(point) {
        this.points.push(point);
        this._boundsDirty = true;
        return this;
    }
    remove() {
        this.points.pop();
        this._boundsDirty = true;
        return this;
    }
    closestPoint(point, inset = 0) {
        const polygon = this.extrude(-inset);
        const n = polygon.points.length;
        let angleSum = 0;
        for (let i = 0; i < n; i++) {
            const p1 = polygon.points[i].clone().subtract(point);
            const p2 = polygon.points[(i + 1) % n].clone().subtract(point);
            angleSum += Math.atan2(p1.cross(p2), p1.dot(p2));
        }
        if (Math.abs(angleSum) > Math.PI) {
            return point.clone();
        }
        let closestPoint = polygon.points[0];
        let minDistance = Infinity;
        for (let i = 0; i < n; i++) {
            const a = polygon.points[i];
            const b = polygon.points[(i + 1) % n];
            const candidate = point.projectOnSegment(a, b);
            const distance = point.distance(candidate);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = candidate;
            }
        }
        return closestPoint;
    }
    extrude(offset, apply = false) {
        if (offset === 0)
            return this;
        const effectiveOffset = Math.abs(offset);
        const n = this.points.length;
        const modified = [];
        const normals = this.points.map((point, i, arr) => {
            const next = arr[(i + 1) % n];
            const edge = next.clone().subtract(point);
            const normal = edge.normal;
            return normal.scale(-Math.sign(offset));
        });
        for (let i = 0; i < n; i++) {
            const curr = this.points[i];
            const prevIndex = (i - 1 + n) % n;
            const p1 = curr.clone().add(normals[prevIndex].clone().scale(effectiveOffset));
            const p2 = curr.clone().add(normals[i].clone().scale(effectiveOffset));
            const d1 = curr.clone().subtract(this.points[prevIndex]);
            const d2 = this.points[(i + 1) % n].clone().subtract(curr);
            const det = d1.cross(d2);
            if (Math.abs(det) < EPSILON) {
                modified.push(p1);
            }
            else {
                const diff = p2.clone().subtract(p1);
                const t = diff.cross(d2) / det;
                const intersect = p1.clone().add(d1.clone().scale(t));
                modified.push(intersect);
            }
        }
        if (apply) {
            this.points.length = 0;
            for (const point of modified) {
                this.points.push(point);
            }
            this._boundsDirty = true;
            return this;
        }
        return new Polygon(modified);
    }
    ensureBounds() {
        if (!this._boundsDirty)
            return;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (p.x < minX)
                minX = p.x;
            if (p.x > maxX)
                maxX = p.x;
            if (p.y < minY)
                minY = p.y;
            if (p.y > maxY)
                maxY = p.y;
        }
        this._minX = minX;
        this._minY = minY;
        this._maxX = maxX;
        this._maxY = maxY;
        this._boundsDirty = false;
    }
    intersects(position, radius = 0) {
        this.ensureBounds();
        const px = position.x;
        const py = position.y;
        if (px < this._minX - radius || px > this._maxX + radius || py < this._minY - radius || py > this._maxY + radius) {
            return false;
        }
        const points = this.points;
        const n = points.length;
        let winding = 0;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const a = points[j];
            const b = points[i];
            if (a.y <= py) {
                if (b.y > py && Vector.TEMP1.set(b).subtract(a).cross(Vector.TEMP2.set(position).subtract(a)) > 0) {
                    winding++;
                }
            }
            else if (b.y <= py && Vector.TEMP1.set(b).subtract(a).cross(Vector.TEMP2.set(position).subtract(a)) < 0) {
                winding--;
            }
        }
        if (winding !== 0)
            return true;
        if (radius > 0) {
            const r2 = radius * radius;
            for (let i = 0, j = n - 1; i < n; j = i++) {
                const a = points[j];
                const b = points[i];
                const ab = Vector.TEMP1.set(b).subtract(a);
                const l2 = ab.magnitudeSquared;
                let t = l2 > 0 ? Vector.TEMP2.set(position).subtract(a).dot(ab) / l2 : 0;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const closest = Vector.TEMP3.set(ab).scale(t).add(a);
                if (position.distanceSquared(closest) <= r2)
                    return true;
            }
        }
        return false;
    }
    clone() {
        return new Polygon(this.points);
    }
    get center() {
        const center = new Vector();
        for (const point of this.points) {
            center.add(point);
        }
        center.divide(this.points.length);
        return center;
    }
    get width() {
        let minX = Infinity;
        let maxX = -Infinity;
        for (const point of this.points) {
            if (point.x < minX) {
                minX = point.x;
            }
            else if (point.x > maxX) {
                maxX = point.x;
            }
        }
        return maxX - minX;
    }
    get height() {
        let minY = Infinity;
        let maxY = -Infinity;
        for (const point of this.points) {
            if (point.y < minY) {
                minY = point.y;
            }
            else if (point.y > maxY) {
                maxY = point.y;
            }
        }
        return maxY - minY;
    }
    get dimensions() {
        const bounds = this.bounds;
        return new Vector(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
    }
    get bounds() {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const point of this.points) {
            if (point.x < minX) {
                minX = point.x;
            }
            else if (point.x > maxX) {
                maxX = point.x;
            }
            if (point.y < minY) {
                minY = point.y;
            }
            else if (point.y > maxY) {
                maxY = point.y;
            }
        }
        return {
            min: new Vector(minX, minY),
            max: new Vector(maxX, maxY),
        };
    }
    get area() {
        let area = 0;
        const n = this.points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += this.points[i].x * this.points[j].y - this.points[j].x * this.points[i].y;
        }
        return Math.abs(area) / 2;
    }
    get perimeter() {
        let perimeter = 0;
        const n = this.points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            perimeter += this.points[i].distance(this.points[j]);
        }
        return perimeter;
    }
}
function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
