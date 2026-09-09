import type { Container } from "pixi.js";

/**
 * A 2D camera: where the view is centred, how far it is zoomed and how it is rotated.
 *
 * It holds no game state and knows nothing about entities — a game moves it (`move`, `zoom`,
 * `angle`) and the renderer applies it to the world container once per frame with `transform`.
 * Interpolation, following a target and screen-space queries belong to the game's own systems,
 * which is also where they can read the game's settings.
 */
export class Camera {
	public x: number;
	public y: number;
	public zoom: number;
	public angle: number;

	public constructor(x: number = 0, y: number = 0, zoom: number = 1, angle: number = 0) {
		this.x = x;
		this.y = y;
		this.zoom = zoom;
		this.angle = angle;
	}

	public move(x: number, y: number): this {
		this.x = x;
		this.y = y;

		return this;
	}

	/**
	 * Apply the camera to a container so that (x, y) lands at the centre of a `width` × `height`
	 * view, scaled by `zoom` and rotated by `angle`.
	 */
	public transform(container: Container, width: number, height: number): this {
		container.pivot.set(this.x, this.y);
		container.position.set(width / 2, height / 2);
		container.scale.set(this.zoom);
		container.rotation = this.angle;

		return this;
	}

	/** Undo `transform`: the container draws in plain screen space again, still centred. */
	public revertTransform(container: Container, width: number, height: number): this {
		container.pivot.set(0, 0);
		container.position.set(width / 2, height / 2);
		container.scale.set(1);
		container.rotation = 0;

		return this;
	}

	/** Screen point → world point, under the current transform. */
	public toWorld(screenX: number, screenY: number, width: number, height: number): { x: number; y: number } {
		const dx = (screenX - width / 2) / this.zoom;
		const dy = (screenY - height / 2) / this.zoom;
		const cos = Math.cos(-this.angle);
		const sin = Math.sin(-this.angle);

		return { x: this.x + dx * cos - dy * sin, y: this.y + dx * sin + dy * cos };
	}

	/** World point → screen point, under the current transform. */
	public toScreen(worldX: number, worldY: number, width: number, height: number): { x: number; y: number } {
		const dx = worldX - this.x;
		const dy = worldY - this.y;
		const cos = Math.cos(this.angle);
		const sin = Math.sin(this.angle);

		return { x: width / 2 + (dx * cos - dy * sin) * this.zoom, y: height / 2 + (dx * sin + dy * cos) * this.zoom };
	}
}
