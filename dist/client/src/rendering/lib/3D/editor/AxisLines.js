import { BufferGeometry, Color, Float32BufferAttribute, LineSegments, ShaderMaterial } from "three";
export class AxisLines extends LineSegments {
    constructor({ xColor = 0xff3352, yColor = 0x2890ff, zColor = 0x8bdc00, showY = true, fadeDistance = 200, fadeStrength = 2 } = {}) {
        const positions = [-1, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 1];
        const x = new Color(xColor);
        const z = new Color(zColor);
        const colors = [x.r, x.g, x.b, x.r, x.g, x.b, z.r, z.g, z.b, z.r, z.g, z.b];
        if (showY) {
            const y = new Color(yColor);
            positions.push(0, -1, 0, 0, 1, 0);
            colors.push(y.r, y.g, y.b, y.r, y.g, y.b);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        const material = new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uFadeDistance: { value: fadeDistance },
                uFadeStrength: { value: fadeStrength },
            },
            vertexShader: `
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
            fragmentShader: `
				uniform float uFadeDistance, uFadeStrength;
				varying vec3 vColor;
				varying vec3 vWorld;
				void main() {
					float fade = 1.0 - min(distance(cameraPosition, vWorld) / uFadeDistance, 1.0);
					float a = pow(fade, uFadeStrength);
					if (a <= 0.0) discard;
					gl_FragColor = vec4(vColor, a);
				}`,
        });
        super(geometry, material);
        this.frustumCulled = false;
        this.renderOrder = 1;
    }
    get uniforms() {
        return this.material.uniforms;
    }
}
