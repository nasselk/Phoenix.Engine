import { Vector } from "./vector.js";
import { EPSILON } from "./utils.js";

import earcut from "earcut";

export class Polygon {
	public readonly points: Vector[];
	public readonly triangles: Polygon[];

	// Cached axis-aligned bounding box, used by intersects() for an O(1) reject. Recomputed lazily
	// (see ensureBounds) whenever the points change; polygons here are built once and rarely mutated.
	private _minX = Infinity;
	private _minY = Infinity;
	private _maxX = -Infinity;
	private _maxY = -Infinity;
	private _boundsDirty = true;

	public constructor(x: number, y: number, width: number, height: number, offset?: number, scale?: number);
	public constructor(shape: Vector[], offset?: number, scale?: number);
	public constructor(a: number | Vector[], b?: number, c?: number, d?: number, e?: number, f?: number) {
		this.triangles = [];

		if (Array.isArray(a)) {
			this.points = a;

			this.init(b, c);
		} else {
			this.points = [];

			this.fromRectangle(a, b, c, d);
			this.init(e, f);
		}
	}

	public *[Symbol.iterator](): IterableIterator<Vector> {
		for (const point of this.points) {
			yield point;
		}
	}

	public forEach(callback: (value: Vector, index?: number) => void): void {
		let i = 0;

		for (const value of this) {
			callback(value, i);

			i++;
		}
	}

	public static union(...polygons: Polygon[]): Polygon {
		const allPoints: Vector[] = [];

		// Gather all vertices from the provided polygons
		polygons.forEach((poly) => allPoints.push(...poly.points));

		// If there are no points, return an empty polygon
		if (allPoints.length === 0) {
			return new Polygon([]);
		}

		// Find the starting point (lowest y, then lowest x)
		let start: Vector = allPoints[0];
		for (const p of allPoints) {
			if (p.y < start.y || (p.y === start.y && p.x < start.x)) {
				start = p;
			}
		}

		// Sort points by polar angle with respect to start.
		const sorted = allPoints.slice();
		sorted.sort((a, b) => {
			const angleA = Math.atan2(a.y - start.y, a.x - start.x);
			const angleB = Math.atan2(b.y - start.y, b.x - start.x);
			return angleA - angleB;
		});

		// Build the convex hull using the Graham scan algorithm.
		const hull: Vector[] = [];
		for (const pt of sorted) {
			// Remove last point from hull while we turn clockwise or it's collinear.
			while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], pt) <= 0) {
				hull.pop();
			}
			hull.push(pt);
		}

		return new Polygon(hull);
	}

	private init(offset: number = 0, scale: number = 1): void {
		for (let i = 0; i < this.points.length; i++) {
			const point = this.points[i];

			this.points[i] = new Vector(offset + point.x * scale, offset + point.y * scale);
		}

		this.triangulate();
	}

	public triangulate(): Polygon[] | void {
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

	private fromRectangle(x: number = 0, y: number = 0, width: number = 0, height: number = 0): void {
		this.points.push(new Vector(x - width / 2, y - height / 2), new Vector(x + width / 2, y - height / 2), new Vector(x + width / 2, y + height / 2), new Vector(x - width / 2, y + height / 2));
	}

	public set(points: Vector[]): this {
		this.points.length = 0;

		this.points.push(...points);

		this._boundsDirty = true;

		return this;
	}

	public add(point: Vector): this {
		this.points.push(point);

		this._boundsDirty = true;

		return this;
	}

	public remove(): this {
		this.points.pop();

		this._boundsDirty = true;

		return this;
	}

	public closestPoint(point: Vector, inset: number = 0): Vector {
		const polygon = this.extrude(-inset);
		const n = polygon.points.length;

		let angleSum = 0;

		for (let i = 0; i < n; i++) {
			const p1 = polygon.points[i].clone().subtract(point);
			const p2 = polygon.points[(i + 1) % n].clone().subtract(point);
			angleSum += Math.atan2(p1.cross(p2), p1.dot(p2));
		}

		if (Math.abs(angleSum) > Math.PI) {
			return point.clone(); // Point is inside
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

	public extrude(offset: number, apply: boolean = false): Polygon {
		if (offset === 0) return this;

		const effectiveOffset = Math.abs(offset);
		const n = this.points.length;
		const modified: Vector[] = [];

		// Precompute normals for each edge.
		// The normal is computed as (-dy, dx) then normalized.
		// For negative offset (shrink), we use the inward normal as-is.
		// For positive offset (extrude), we reverse it.
		const normals = this.points.map((point, i, arr) => {
			const next = arr[(i + 1) % n];

			const edge = next.clone().subtract(point);

			const normal = edge.normal;

			return normal.scale(-Math.sign(offset));
		});

		for (let i = 0; i < n; i++) {
			const curr = this.points[i];
			const prevIndex = (i - 1 + n) % n;

			// Offset current vertex using the normal from the previous edge.
			const p1 = curr.clone().add(normals[prevIndex].clone().scale(effectiveOffset));
			// Also compute the offset using the normal of the current edge.
			const p2 = curr.clone().add(normals[i].clone().scale(effectiveOffset));

			// Calculate the direction vectors for the original edges.
			const d1 = curr.clone().subtract(this.points[prevIndex]);
			const d2 = this.points[(i + 1) % n].clone().subtract(curr);

			const det = d1.cross(d2);

			if (Math.abs(det) < EPSILON) {
				modified.push(p1);
			} else {
				// Compute t such that intersection = p1 + t*d1.
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

	private ensureBounds(): void {
		if (!this._boundsDirty) return;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (let i = 0; i < this.points.length; i++) {
			const p = this.points[i];

			if (p.x < minX) minX = p.x;
			if (p.x > maxX) maxX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.y > maxY) maxY = p.y;
		}

		this._minX = minX;
		this._minY = minY;
		this._maxX = maxX;
		this._maxY = maxY;
		this._boundsDirty = false;
	}

	public intersects(position: Vector, radius: number = 0): boolean {
		this.ensureBounds();

		const px = position.x;
		const py = position.y;

		// Fast reject: if the point (grown by radius) is outside the polygon's AABB it can't intersect.
		// This is the common case for e.g. biome lookups, where 4 of 5 biomes reject here in 4 comparisons.
		if (px < this._minX - radius || px > this._maxX + radius || py < this._minY - radius || py > this._maxY + radius) {
			return false;
		}

		const points = this.points;
		const n = points.length;

		// Winding-number point-in-polygon. Uses one cross product per crossing edge (Vector.cross) instead of the
		// old per-edge atan2, and the shared TEMP vectors instead of .clone(), so it stays allocation-free and
		// trig-free while remaining correct for convex AND concave simple polygons.
		// (Relies on Vector.TEMP1..TEMP3 — a caller must not hold those across this call; none currently do.)
		let winding = 0;

		for (let i = 0, j = n - 1; i < n; j = i++) {
			const a = points[j];
			const b = points[i];

			if (a.y <= py) {
				// Upward crossing: count when `position` is left of edge a→b (cross > 0).
				if (b.y > py && Vector.TEMP1.set(b).subtract(a).cross(Vector.TEMP2.set(position).subtract(a)) > 0) {
					winding++;
				}
			} else if (b.y <= py && Vector.TEMP1.set(b).subtract(a).cross(Vector.TEMP2.set(position).subtract(a)) < 0) {
				// Downward crossing: count when `position` is right of edge a→b (cross < 0).
				winding--;
			}
		}

		if (winding !== 0) return true;

		// A circle can also touch an edge from outside — only relevant when radius > 0 (radius 0 is fully answered
		// by the winding test above). Closest-point-on-segment via TEMP + squared distance (no sqrt, no allocation).
		if (radius > 0) {
			const r2 = radius * radius;

			for (let i = 0, j = n - 1; i < n; j = i++) {
				const a = points[j];
				const b = points[i];

				const ab = Vector.TEMP1.set(b).subtract(a); // edge a→b
				const l2 = ab.magnitudeSquared;

				let t = l2 > 0 ? Vector.TEMP2.set(position).subtract(a).dot(ab) / l2 : 0;
				t = t < 0 ? 0 : t > 1 ? 1 : t;

				// Closest point on the segment = a + ab * t.
				const closest = Vector.TEMP3.set(ab).scale(t).add(a);

				if (position.distanceSquared(closest) <= r2) return true;
			}
		}

		return false;
	}

	public clone(): Polygon {
		return new Polygon(this.points);
	}

	public get center(): Vector {
		const center = new Vector();

		for (const point of this.points) {
			center.add(point);
		}

		center.divide(this.points.length);

		return center;
	}

	public get width(): number {
		let minX = Infinity;
		let maxX = -Infinity;

		for (const point of this.points) {
			if (point.x < minX) {
				minX = point.x;
			} else if (point.x > maxX) {
				maxX = point.x;
			}
		}

		return maxX - minX;
	}

	public get height(): number {
		let minY = Infinity;
		let maxY = -Infinity;

		for (const point of this.points) {
			if (point.y < minY) {
				minY = point.y;
			} else if (point.y > maxY) {
				maxY = point.y;
			}
		}

		return maxY - minY;
	}

	public get dimensions(): Vector {
		const bounds = this.bounds;

		return new Vector(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
	}

	public get bounds(): { min: Vector; max: Vector } {
		let minX = Infinity;
		let maxX = -Infinity;

		let minY = Infinity;
		let maxY = -Infinity;

		for (const point of this.points) {
			if (point.x < minX) {
				minX = point.x;
			} else if (point.x > maxX) {
				maxX = point.x;
			}

			if (point.y < minY) {
				minY = point.y;
			} else if (point.y > maxY) {
				maxY = point.y;
			}
		}

		return {
			min: new Vector(minX, minY),
			max: new Vector(maxX, maxY),
		};
	}

	public get area(): number {
		let area = 0;

		const n = this.points.length;

		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;

			area += this.points[i].x * this.points[j].y - this.points[j].x * this.points[i].y;
		}

		return Math.abs(area) / 2;
	}

	public get perimeter(): number {
		let perimeter = 0;

		const n = this.points.length;

		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;

			perimeter += this.points[i].distance(this.points[j]);
		}

		return perimeter;
	}
}

/**
 * Computes the cross product of (A-O) x (B-O)
 * If the result is positive, then the sequence O, A, B makes a counter-clockwise turn.
 */
function cross(o: Vector, a: Vector, b: Vector): number {
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
