import { Color, type ColorRepresentation, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from "three";

export interface InfiniteGridOptions {
	/** Spacing between minor lines, in world units. */
	readonly minorSize?: number;
	/** Spacing between major lines, in world units. */
	readonly majorSize?: number;
	readonly color?: ColorRepresentation;
	/** Opacity of minor lines relative to major ones, 0–1. */
	readonly minorOpacity?: number;
	/** Distance from the camera at which the grid has fully faded out. */
	readonly fadeDistance?: number;
	/** Exponent of the fade curve: higher fades out sooner. */
	readonly fadeStrength?: number;
}

/**
 * A floor grid on the XZ plane that never runs out: the plane follows the camera in the vertex
 * shader, and the lines are computed from world position so they stay put while it moves.
 * `fwidth` keeps lines a constant pixel width, and the distance fade hides the horizon.
 */
export class InfiniteGrid extends Mesh<PlaneGeometry, ShaderMaterial> {
	public constructor({ minorSize = 2, majorSize = 10, color = 0x9a9a9a, minorOpacity = 0.5, fadeDistance = 200, fadeStrength = 2 }: InfiniteGridOptions = {}) {
		const material = new ShaderMaterial({
			transparent: true,
			depthWrite: false,
			side: DoubleSide,
			uniforms: {
				uMinorSize: { value: minorSize },
				uMajorSize: { value: majorSize },
				uColor: { value: new Color(color) },
				uMinorOpacity: { value: minorOpacity },
				uFadeDistance: { value: fadeDistance },
				uFadeStrength: { value: fadeStrength },
			},

			vertexShader: /* glsl */ `
				uniform float uFadeDistance;
				varying vec3 vWorld;
				void main() {
					// Big enough to reach the fade distance. The plane lies in local XY; after the
					// -90deg X rotation, local Y maps to world -Z.
					vec3 p = position * uFadeDistance * 2.0;
					p.x += cameraPosition.x;
					p.y -= cameraPosition.z;
					vec4 world = modelMatrix * vec4(p, 1.0);
					vWorld = world.xyz;
					gl_Position = projectionMatrix * viewMatrix * world;
				}`,

			fragmentShader: /* glsl */ `
				uniform float uMinorSize, uMajorSize, uMinorOpacity, uFadeDistance, uFadeStrength;
				uniform vec3 uColor;
				varying vec3 vWorld;

				float gridLines(vec2 p, float size) {
					vec2 c = p / size;
					vec2 d = fwidth(c);
					vec2 g = abs(fract(c - 0.5) - 0.5) / d;
					return 1.0 - min(min(g.x, g.y), 1.0);
				}

				void main() {
					float fade = 1.0 - min(distance(cameraPosition.xz, vWorld.xz) / uFadeDistance, 1.0);
					float g = max(gridLines(vWorld.xz, uMinorSize) * uMinorOpacity, gridLines(vWorld.xz, uMajorSize));
					float a = g * pow(fade, uFadeStrength);
					if (a <= 0.0) discard;
					gl_FragColor = vec4(uColor, a);
				}`,
		});

		super(new PlaneGeometry(1, 1), material);

		this.rotation.x = -Math.PI / 2;
		this.frustumCulled = false;
	}

	/** Uniforms, for tweaking the grid after construction. */
	public get uniforms() {
		return this.material.uniforms;
	}
}
