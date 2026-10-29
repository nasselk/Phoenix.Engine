import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { FADE, FOLLOW_VERTEX, fadeUniforms } from "./shaders";
export class InfinitePlane extends Mesh {
    constructor({ color = 0x3a3a3a, opacity = 1, height = 0, fadeDistance = 200, fadeStrength = 2 } = {}) {
        const material = new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            uniforms: {
                uColor: { value: new Color(color) },
                uOpacity: { value: opacity },
                ...fadeUniforms(fadeDistance, fadeStrength),
            },
            vertexShader: FOLLOW_VERTEX,
            fragmentShader: `
				${FADE}
				uniform vec3 uColor;
				uniform float uOpacity;
				varying vec3 vWorld;
				void main() {
					float a = uOpacity * fade(distance(cameraPosition.xz, vWorld.xz));
					if (a <= 0.0) discard;
					gl_FragColor = vec4(uColor, a);
				}`,
        });
        super(new PlaneGeometry(1, 1), material);
        this.rotation.x = -Math.PI / 2;
        this.position.y = height;
        this.frustumCulled = false;
        this.renderOrder = -1;
    }
    get uniforms() {
        return this.material.uniforms;
    }
}
//# sourceMappingURL=InfinitePlane.js.map