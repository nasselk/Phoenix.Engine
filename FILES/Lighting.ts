import { NeutralToneMapping, DirectionalLight, HemisphereLight, PCFShadowMap, type Scene, SRGBColorSpace, Vector3, type WebGLRenderer } from "three";

export type LightingOptions = {
	readonly sky?: number;
	readonly ground?: number;
	readonly sun?: number;
	/** Where the sun shines from, relative to what it follows. */
	readonly direction?: Vector3;
	/** Half the side of the square the sun casts shadows over, around what it follows. */
	readonly shadowRadius?: number;
	readonly shadowResolution?: number;
	readonly exposure?: number;
};

/**
 * Bright, soft daylight: a sky/ground fill that keeps shadows coloured rather than grey, and a sun that
 * casts soft shadows around whatever it follows, so shadows stay sharp near the player on a big map. The
 * shadows move in whole shadow-map texels, so their edges stay still while it moves.
 */
export class Lighting {
	public readonly sun: DirectionalLight;
	public readonly fill: HemisphereLight;

	private readonly offset: Vector3;
	private readonly exposure: number;
	/** The sun's own axes: across and up its shadow map, and along its rays. */
	private readonly across = new Vector3();
	private readonly up = new Vector3();
	private readonly along = new Vector3();
	private readonly texel: number;
	private configured = false;

	public constructor(scene: Scene, options: LightingOptions = {}) {
		const radius = options.shadowRadius ?? 45;

		this.exposure = options.exposure ?? 0.92;
		this.offset = (options.direction ?? new Vector3(40, 70, 30)).clone();
		this.along.copy(this.offset).normalize().negate();
		this.across.set(0, 1, 0).cross(this.along).normalize();
		this.up.copy(this.along).cross(this.across).normalize();
		this.texel = (radius * 2) / (options.shadowResolution ?? 2048);

		this.fill = new HemisphereLight(options.sky ?? 0xcfeeff, options.ground ?? 0xffd9a8, 1.25);

		this.sun = new DirectionalLight(options.sun ?? 0xfff1d6, 2.4);
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(options.shadowResolution ?? 2048, options.shadowResolution ?? 2048);
		this.sun.shadow.camera.left = -radius;
		this.sun.shadow.camera.right = radius;
		this.sun.shadow.camera.top = radius;
		this.sun.shadow.camera.bottom = -radius;
		this.sun.shadow.camera.near = 1;
		this.sun.shadow.camera.far = 260;
		this.sun.shadow.bias = -0.0004;
		this.sun.shadow.normalBias = 0.04;
		this.sun.shadow.radius = 3;

		scene.add(this.fill, this.sun, this.sun.target);

		// The renderer is the engine's: its colour and shadow settings are set the first time it draws this scene.
		const before = scene.onBeforeRender;

		scene.onBeforeRender = (renderer, ...rest) => {
			this.configure(renderer as WebGLRenderer);
			before.call(scene, renderer, ...rest);
		};
	}

	/** Keep the sun's shadows around this point. */
	public follow(target: { readonly x: number; readonly y: number; readonly z: number }): void {
		const { across, up, along, texel } = this;
		const a = Math.round((target.x * across.x + target.y * across.y + target.z * across.z) / texel) * texel;
		const b = Math.round((target.x * up.x + target.y * up.y + target.z * up.z) / texel) * texel;
		const c = target.x * along.x + target.y * along.y + target.z * along.z;
		const center = this.sun.target.position;

		center.set(across.x * a + up.x * b + along.x * c, across.y * a + up.y * b + along.y * c, across.z * a + up.z * b + along.z * c);
		this.sun.position.copy(center).add(this.offset);
	}

	private configure(renderer: WebGLRenderer): void {
		if (this.configured) {
			return;
		}

		this.configured = true;

		renderer.toneMapping = NeutralToneMapping;
		renderer.toneMappingExposure = this.exposure;
		renderer.outputColorSpace = SRGBColorSpace;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = PCFShadowMap;
	}
}
