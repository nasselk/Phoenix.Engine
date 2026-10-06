import { BackSide, Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Object3D, ShaderChunk, ShaderMaterial, SphereGeometry, Vector3 } from "three";

export type SkyOptions = {
	readonly zenith?: number;
	readonly horizon?: number;
	readonly ground?: number;
	readonly sun?: number;
	/** Where the sun is, as a direction. */
	readonly sunDirection?: Vector3;
	/** The area clouds drift over: x from -width to width, z from `front` back to `back`. */
	readonly cloudArea?: { readonly width: number; readonly front: number; readonly back: number };
	readonly clouds?: number;
	readonly radius?: number;
};

const PUFFS_PER_CLOUD = 7;

const vec3 = (color: Color | Vector3) => (color instanceof Color ? `vec3(${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)})` : `vec3(${color.x.toFixed(5)}, ${color.y.toFixed(5)}, ${color.z.toFixed(5)})`);

/** The sky's colour in a direction, in linear space: the dome draws it, and the fog fades everything toward it. */
function skyFunction(zenith: Color, horizon: Color, ground: Color, sun: Color, sunDirection: Vector3): string {
	return /* glsl */ `
		vec3 skyColor(vec3 direction) {
			float height = direction.y;
			vec3 color = height > 0.0 ? mix(${vec3(horizon)}, ${vec3(zenith)}, pow(height, 0.55)) : mix(${vec3(horizon)}, ${vec3(ground)}, pow(-height, 0.4));
			float sun = max(dot(direction, ${vec3(sunDirection)}), 0.0);

			return color + ${vec3(sun)} * (pow(sun, 900.0) * 1.6 + pow(sun, 24.0) * 0.35 + pow(sun, 4.0) * 0.08);
		}
	`;
}

/**
 * Every material's fog, from now on, fades toward the sky behind the surface instead of one flat colour,
 * so far things dissolve into the sky itself and nothing keeps its outline against it. Materials compiled
 * before this keep the flat fog, so it runs before anything with fog is drawn.
 */
function fogIntoSky(sky: string): void {
	ShaderChunk.fog_pars_vertex = /* glsl */ `
		#ifdef USE_FOG
			varying float vFogDepth;
			varying vec3 vFogDirection;
		#endif
	`;
	ShaderChunk.fog_vertex = /* glsl */ `
		#ifdef USE_FOG
			vFogDepth = - mvPosition.z;
			vFogDirection = transpose(mat3(viewMatrix)) * mvPosition.xyz;
		#endif
	`;
	ShaderChunk.fog_pars_fragment = /* glsl */ `
		#ifdef USE_FOG
			uniform vec3 fogColor;
			varying float vFogDepth;
			varying vec3 vFogDirection;

			#ifdef FOG_EXP2
				uniform float fogDensity;
			#else
				uniform float fogNear;
				uniform float fogFar;
			#endif

			${sky}
		#endif
	`;
	ShaderChunk.fog_fragment = /* glsl */ `
		#ifdef USE_FOG
			#ifdef FOG_EXP2
				float fogFactor = 1.0 - exp(- fogDensity * fogDensity * vFogDepth * vFogDepth);
			#else
				float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
			#endif

			gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(skyColor(normalize(vFogDirection)), 1.0)).rgb, fogFactor);
		#endif
	`;
}

/**
 * A bright cartoon sky: a gradient dome that follows the camera, a soft sun, and fat clouds made of
 * puffs that drift slowly. Nothing in it is lit by the scene's fog; instead, the fog fades into it.
 */
export class Sky extends Group {
	public readonly horizon: Color;

	private readonly dome: Mesh;
	private readonly clouds: InstancedMesh;
	private readonly cloudOrigins: Vector3[] = [];
	private readonly cloudPuffs: { offset: Vector3; scale: number }[] = [];
	private readonly cloudArea: { readonly width: number; readonly front: number; readonly back: number };
	private time = 0;

	private static readonly matrix = new Matrix4();
	private static readonly dummy = new Object3D();

	public constructor(options: SkyOptions = {}) {
		super();

		const radius = options.radius ?? 2800;

		this.horizon = new Color(options.horizon ?? 0xbdf0ff);
		this.cloudArea = options.cloudArea ?? { width: 900, front: 600, back: -1800 };

		const sky = skyFunction(new Color(options.zenith ?? 0x2a8bff), this.horizon, new Color(options.ground ?? 0x7fd8f0), new Color(options.sun ?? 0xfff3c4), (options.sunDirection ?? new Vector3(0.4, 0.55, 0.35)).clone().normalize());

		fogIntoSky(sky);

		this.dome = new Mesh(
			new SphereGeometry(radius, 32, 16),
			new ShaderMaterial({
				side: BackSide,
				depthWrite: false,
				fog: false,
				vertexShader: /* glsl */ `
					varying vec3 vDirection;

					void main() {
						vDirection = normalize(position);
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
						gl_Position.z = gl_Position.w;
					}
				`,
				fragmentShader: /* glsl */ `
					varying vec3 vDirection;

					${sky}

					void main() {
						gl_FragColor = vec4(skyColor(normalize(vDirection)), 1.0);

						#include <colorspace_fragment>
					}
				`,
			}),
		);

		this.dome.renderOrder = -1;
		this.dome.frustumCulled = false;

		const count = options.clouds ?? 46;

		this.clouds = new InstancedMesh(new IcosahedronGeometry(1, 3), new MeshLambertMaterial({ color: 0xffffff, emissive: 0x9fb8d8, emissiveIntensity: 0.35, fog: false }), count * PUFFS_PER_CLOUD);
		this.clouds.frustumCulled = false;

		for (let cloud = 0; cloud < count; cloud++) {
			const { width, front, back } = this.cloudArea;

			this.cloudOrigins.push(new Vector3((Math.random() * 2 - 1) * width, 140 + Math.random() * 160, back + Math.random() * (front - back)));

			const size = 14 + Math.random() * 18;

			for (let puff = 0; puff < PUFFS_PER_CLOUD; puff++) {
				const along = (puff / (PUFFS_PER_CLOUD - 1) - 0.5) * 2;

				this.cloudPuffs.push({
					offset: new Vector3(along * size * 1.6, (1 - Math.abs(along)) * size * 0.35 + Math.random() * 4, (Math.random() - 0.5) * size * 0.8),
					scale: size * (0.55 + (1 - Math.abs(along)) * 0.55) * (0.8 + Math.random() * 0.3),
				});
			}
		}

		this.add(this.dome, this.clouds);
		this.placeClouds();
	}

	/** Follow the camera, so the sky is always around it, and let the clouds drift. */
	public update(deltaTime: number, camera: Vector3): void {
		this.time += deltaTime;
		this.dome.position.copy(camera);
		this.placeClouds();
	}

	private placeClouds(): void {
		const { dummy, matrix } = Sky;
		const { width } = this.cloudArea;

		for (let cloud = 0; cloud < this.cloudOrigins.length; cloud++) {
			const origin = this.cloudOrigins[cloud]!;
			const x = ((origin.x + this.time * 3 + width) % (2 * width)) - width;

			for (let puff = 0; puff < PUFFS_PER_CLOUD; puff++) {
				const index = cloud * PUFFS_PER_CLOUD + puff;
				const { offset, scale } = this.cloudPuffs[index]!;

				dummy.position.set(x + offset.x, origin.y + offset.y, origin.z + offset.z);
				dummy.scale.set(scale, scale * 0.62, scale);
				dummy.updateMatrix();

				matrix.copy(dummy.matrix);
				this.clouds.setMatrixAt(index, matrix);
			}
		}

		this.clouds.instanceMatrix.needsUpdate = true;
	}
}
