import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { FADE, FOLLOW_VERTEX, fadeUniforms } from "./shaders";
export class InfiniteGrid extends Mesh {
    constructor({ minorSize = 2, majorSize = 10, color = 0x9a9a9a, minorOpacity = 0.5, fadeDistance = 200, fadeStrength = 2 } = {}) {
        const material = new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            uniforms: {
                uMinorSize: { value: minorSize },
                uMajorSize: { value: majorSize },
                uColor: { value: new Color(color) },
                uMinorOpacity: { value: minorOpacity },
                ...fadeUniforms(fadeDistance, fadeStrength),
            },
            vertexShader: FOLLOW_VERTEX,
            fragmentShader: `
				${FADE}
				uniform float uMinorSize, uMajorSize, uMinorOpacity;
				uniform vec3 uColor;
				varying vec3 vWorld;

				float gridLines(vec2 p, float size) {
					vec2 c = p / size;
					vec2 d = fwidth(c);
					vec2 g = abs(fract(c - 0.5) - 0.5) / d;
					return 1.0 - min(min(g.x, g.y), 1.0);
				}

				void main() {
					float g = max(gridLines(vWorld.xz, uMinorSize) * uMinorOpacity, gridLines(vWorld.xz, uMajorSize));
					float a = g * fade(distance(cameraPosition.xz, vWorld.xz));
					if (a <= 0.0) discard;
					gl_FragColor = vec4(uColor, a);
				}`,
        });
        super(new PlaneGeometry(1, 1), material);
        this.rotation.x = -Math.PI / 2;
        this.frustumCulled = false;
    }
    get uniforms() {
        return this.material.uniforms;
    }
}
//# sourceMappingURL=InfiniteGrid.js.map