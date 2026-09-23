import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from "three";
export class InfinitePlane extends Mesh {
    constructor({ color = 0x3a3a3a, opacity = 1, height = 0, fadeDistance = 200, fadeStrength = 2 } = {}) {
        const material = new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            uniforms: {
                uColor: { value: new Color(color) },
                uOpacity: { value: opacity },
                uFadeDistance: { value: fadeDistance },
                uFadeStrength: { value: fadeStrength },
            },
            vertexShader: `
				uniform float uFadeDistance;
				varying vec3 vWorld;
				void main() {
					vec3 p = position * uFadeDistance * 2.0;
					p.x += cameraPosition.x;
					p.y -= cameraPosition.z;
					vec4 world = modelMatrix * vec4(p, 1.0);
					vWorld = world.xyz;
					gl_Position = projectionMatrix * viewMatrix * world;
				}`,
            fragmentShader: `
				uniform vec3 uColor;
				uniform float uOpacity, uFadeDistance, uFadeStrength;
				varying vec3 vWorld;
				void main() {
					float fade = 1.0 - min(distance(cameraPosition.xz, vWorld.xz) / uFadeDistance, 1.0);
					float a = uOpacity * pow(fade, uFadeStrength);
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
