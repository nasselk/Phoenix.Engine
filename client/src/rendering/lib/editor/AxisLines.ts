import { BufferGeometry, Color, type ColorRepresentation, Float32BufferAttribute, LineSegments, ShaderMaterial } from "three";
import { FADE, fadeUniforms } from "./shaders";

export interface AxisLinesOptions {
	readonly xColor?: ColorRepresentation;
	readonly yColor?: ColorRepresentation;
	readonly zColor?: ColorRepresentation;
	readonly showY?: boolean;
	readonly fadeDistance?: number;
	readonly fadeStrength?: number;
}

export class AxisLines extends LineSegments<BufferGeometry, ShaderMaterial> {
	/** Each axis's color, which the EngineEditor gizmo shows too. */
	public readonly colors: Readonly<Record<"x" | "y" | "z", Color>>;

	public constructor({ xColor = 0xff3352, yColor = 0x8bdc00, zColor = 0x2890ff, showY = true, fadeDistance = 200, fadeStrength = 2 }: AxisLinesOptions = {}) {
		const positions = [-1, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 1];
		const x = new Color(xColor);
		const y = new Color(yColor);
		const z = new Color(zColor);
		const colors = [x.r, x.g, x.b, x.r, x.g, x.b, z.r, z.g, z.b, z.r, z.g, z.b];
		if (showY) {
			positions.push(0, -1, 0, 0, 1, 0);
			colors.push(y.r, y.g, y.b, y.r, y.g, y.b);
		}

		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
		geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

		const material = new ShaderMaterial({
			transparent: true,
			depthWrite: false,
			uniforms: fadeUniforms(fadeDistance, fadeStrength),

			vertexShader: /* glsl */ `
				uniform float uFadeDistance;
				attribute vec3 color;
				varying vec3 vColor;
				varying vec3 vWorld;
				void main() {
					vec3 dir = abs(position);
					vec3 p = position * uFadeDistance * 2.0 + dir * dot(cameraPosition, dir);
					vec4 world = modelMatrix * vec4(p, 1.0);
					vWorld = world.xyz;
					vColor = color;
					gl_Position = projectionMatrix * viewMatrix * world;
				}`,

			fragmentShader: /* glsl */ `
				${FADE}
				varying vec3 vColor;
				varying vec3 vWorld;
				void main() {
					float a = fade(distance(cameraPosition, vWorld));
					if (a <= 0.0) discard;
					gl_FragColor = vec4(vColor, a);
				}`,
		});

		super(geometry, material);

		this.colors = { x, y, z };
		this.frustumCulled = false;
		this.renderOrder = 1;
	}

	public get uniforms() {
		return this.material.uniforms;
	}
}
