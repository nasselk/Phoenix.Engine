import { type serverSchemas } from "@libs/schema/schemas/server";

import { Interpolator } from "@libs/math/interpolation";

import type { SchemaToData } from "@libs/schema/types";

import { BufferReader } from "@libs/buffer/reader";

import { getBoundingBox } from "@libs/math/utils";

import { UpdateCallback } from "../networking/updates/handler";

import { Vector } from "@libs/math/vector";

import { Entity } from "../entities/entity";

import { type Container } from "pixi.js";

import Game from "../game";

export class Camera {
	public readonly position: Vector;
	public readonly boundingBox: Vector;
	private readonly previous: { readonly position: Vector };
	public readonly target: { readonly position: Vector; angle: number; zoom: number; entity?: Entity | null };
	private readonly interpolation: typeof Game.settings.interpolation;
	private readonly canvas: HTMLCanvasElement;
	private lastUpdate: number;
	public syncZoom: boolean;
	public syncPosition: boolean;
	public locked: boolean;
	public angle: number;
	public zoom: number;
	// Per-frame cached rotation for the world→screen projection (recomputed once per frame in render()).
	private screenCos: number;
	private screenSin: number;
	// Transient result reused by projectToScreen() to avoid per-entity allocation. Read it immediately; do not retain.
	private readonly screenPoint: Vector;

	public constructor(canvas: HTMLCanvasElement, interpolation: Camera["interpolation"]) {
		this.zoom = 1;
		this.angle = 0;
		this.position = new Vector(Infinity);
		this.boundingBox = new Vector();
		this.previous = { position: this.position.clone() };
		this.target = { position: this.position.clone(), angle: this.angle, zoom: this.zoom };
		this.interpolation = { ...interpolation }; // Destructuring to clone
		this.syncPosition = true;
		this.syncZoom = true;
		this.locked = false;
		this.canvas = canvas;
		this.lastUpdate = 0;
		this.screenCos = 1;
		this.screenSin = 0;
		this.screenPoint = new Vector();
	}

	public synchronize(data: SchemaToData<typeof serverSchemas.camera>): this {
		this.previous.position.set(this.position);

		// position
		if (this.syncPosition) {
			const x = BufferReader.fromPrecision(data.x, Game.map.bounds.max.x, 16);
			const y = BufferReader.fromPrecision(data.y, Game.map.bounds.max.y, 16);

			this.target.position.set(x, y);

			// Snap immediatly on connection
			if (this.position.equals(Infinity)) {
				this.position.set(this.target.position);
				this.previous.position.set(this.position);
			}
		}

		// zoom
		if (this.syncZoom) {
			const zoom = BufferReader.fromPrecision(data.zoom, 15, 8);

			this.target.zoom = zoom;
		}

		this.lastUpdate = UpdateCallback.lastUpdate;

		return this;
	}

	public update(deltaTime: number, now: number): this {
		if (this.target.entity) {
			this.target.position.set(this.target.entity.position);
		}

		if (!this.locked) {
			this.position.x = Interpolator.tween(this.previous.position.x, this.target.position.x, this.interpolation.time.camera, now - this.lastUpdate);
			this.position.y = Interpolator.tween(this.previous.position.y, this.target.position.y, this.interpolation.time.camera, now - this.lastUpdate);

			this.angle = Interpolator.lerpAngle(this.angle, this.target.angle, this.interpolation.frame.angle, deltaTime);
			this.zoom = Interpolator.lerp(this.zoom, this.target.zoom * Game.settings.rendering.zoom * Game.loop.resolution, this.interpolation.frame.zoom, deltaTime);

			this.boundingBox.set(getBoundingBox(this.canvas.width, this.canvas.height, this.angle));
		}

		// Cache the rotation once per frame so the per-entity visibility projection (projectToScreen) avoids
		// recomputing Math.cos/sin for every entity. Angle is constant while locked, so this stays valid.
		this.screenCos = Math.cos(this.angle);
		this.screenSin = Math.sin(this.angle);

		return this;
	}

	/**
	 * Projects a world point to screen-space coordinates using the per-frame cached rotation.
	 * Allocation-free: returns a shared Vector that is overwritten on the next call — read it immediately.
	 * Equivalent to toLocalPoint(world) but without cloning or recomputing the rotation per call.
	 */
	public projectToScreen(x: number, y: number): Vector {
		const dx = x - this.position.x;
		const dy = y - this.position.y;

		const rx = dx * this.screenCos - dy * this.screenSin;
		const ry = dx * this.screenSin + dy * this.screenCos;

		return this.screenPoint.set(this.canvas.width / 2 + rx * this.zoom, this.canvas.height / 2 + ry * this.zoom);
	}

	public move(x: number, y: number, immediate: boolean = false): this {
		this.target.position.set(x, y);

		if (immediate) {
			this.position.set(this.target.position);
		}

		return this;
	}

	public rotate(angle: number, immediate: boolean = false): this {
		this.target.angle = angle;

		if (immediate) {
			this.angle = this.target.angle;
		}

		return this;
	}

	public transform(...containers: Container[]): this {
		const center = new Vector(this.canvas.width / 2, this.canvas.height / 2);

		for (const container of containers) {
			container.pivot.set(this.position.x, this.position.y);
			container.position.set(center.x, center.y);
			container.scale.set(this.zoom);

			container.rotation = this.angle;
		}

		return this;
	}

	public revertTransform(...containers: Container[]): this {
		const center = new Vector(this.canvas.width / 2, this.canvas.height / 2);

		for (const container of containers) {
			container.pivot.set(0, 0);
			container.position.set(center.x, center.y);
			container.scale.set(1);

			container.rotation = 0;
		}

		return this;
	}

	public toBufferPoint(position: Vector): Vector;
	public toBufferPoint(x: number, y?: number): Vector;
	public toBufferPoint(a: number | Vector, b?: number): Vector {
		const position = a instanceof Vector ? a.clone() : new Vector(a, b!);

		return position.scale(Game.loop.resolution * devicePixelRatio);
	}

	// Transforms a point from world coordinates to local screen coordinates.
	public toLocalPoint(position: Vector): Vector;
	public toLocalPoint(x: number, y?: number): Vector;
	public toLocalPoint(a: number | Vector, b?: number): Vector {
		const position = a instanceof Vector ? a.clone() : new Vector(a, b!);

		position.subtract(this.position).rotate(this.angle);

		return new Vector(this.canvas.width / 2 + position.x * this.zoom, this.canvas.height / 2 + position.y * this.zoom);
	}

	// Transforms a point from local screen coordinates to world coordinates.
	public toGlobalPoint(position: Vector): Vector;
	public toGlobalPoint(x: number, y?: number): Vector;
	public toGlobalPoint(a: number | Vector, b?: number): Vector {
		const position = a instanceof Vector ? a : new Vector(a, b!);

		const centered = new Vector((position.x - this.canvas.width / 2) / this.zoom, (position.y - this.canvas.height / 2) / this.zoom);

		return centered.rotate(-this.angle).add(this.position);
	}

	public selectEntities(pointer: Vector, predicate?: (entity: Entity) => boolean, range: number = 0, sort: boolean = true): Entity[] {
		const position = this.toGlobalPoint(pointer);

		const entities: Entity[] = [];

		for (const entity of Entity.list.values()) {
			const halfWidth = entity.size.x / 2 + range;
			const halfHeight = entity.size.y / 2 + range;

			if (entity.position.x - halfWidth < position.x && entity.position.x + halfWidth > position.x && entity.position.y - halfHeight < position.y && entity.position.y + halfHeight > position.y && (predicate?.(entity) ?? true)) {
				entities.push(entity);
			}
		}

		if (sort) {
			const layerThreshold = 25;

			entities.sort((a, b) => {
				const distanceA = a.position.distance(position);
				const distanceB = b.position.distance(position);
				const distanceDiff = distanceA - distanceB;

				if (Math.abs(distanceDiff) < layerThreshold) {
					return b.layer - a.layer;
				}

				return distanceDiff;
			});
		}

		return entities;
	}

	public getVisibleRect(position: Vector, size: Vector, accountOfAngle: boolean = true): { position: Vector; size: Vector } | void {
		// Rectangle corners (entity)
		const half = size.clone().divide(2);
		const rectCorners = [
			position.clone().subtract(half), // top-left
			position.clone().add(new Vector(half.x, -half.y)), // top-right
			position.clone().add(half), // bottom-right
			position.clone().add(new Vector(-half.x, half.y)), // bottom-left
		];

		// Camera FOV rectangle corners
		const FOV = new Vector(this.canvas.width / 2, this.canvas.height / 2).divide(this.zoom);
		const fovCenter = this.position.clone();
		const fovHalf = FOV;
		const fovCorners = [
			fovCenter.clone().subtract(fovHalf), // top-left
			fovCenter.clone().add(new Vector(fovHalf.x, -fovHalf.y)), // top-right
			fovCenter.clone().add(fovHalf), // bottom-right
			fovCenter.clone().add(new Vector(-fovHalf.x, fovHalf.y)), // bottom-left
		];

		// Rotate all corners by -camera angle to align with screen axes
		const angle = accountOfAngle ? -this.angle : 0;
		const rotate = (v: Vector) => v.clone().subtract(this.position).rotate(angle).add(this.position);

		const rotatedRect = rectCorners.map(rotate);
		const rotatedFOV = fovCorners.map(rotate);

		// Find axis-aligned bounding boxes after rotation
		const rectMin = new Vector(Math.min(...rotatedRect.map((v) => v.x)), Math.min(...rotatedRect.map((v) => v.y)));
		const rectMax = new Vector(Math.max(...rotatedRect.map((v) => v.x)), Math.max(...rotatedRect.map((v) => v.y)));

		const fovMin = new Vector(Math.min(...rotatedFOV.map((v) => v.x)), Math.min(...rotatedFOV.map((v) => v.y)));
		const fovMax = new Vector(Math.max(...rotatedFOV.map((v) => v.x)), Math.max(...rotatedFOV.map((v) => v.y)));

		// Intersection min/max
		const minimum = new Vector(Math.max(rectMin.x, fovMin.x), Math.max(rectMin.y, fovMin.y));

		const maximum = new Vector(Math.min(rectMax.x, fovMax.x), Math.min(rectMax.y, fovMax.y));

		// If not visible at all
		if (minimum.x >= maximum.x || minimum.y >= maximum.y) {
			return;
		}

		const visiblePosition = minimum.clone().add(maximum).scale(0.5);
		const visibleSize = maximum.clone().subtract(minimum);

		return { position: visiblePosition, size: visibleSize };
	}
}
