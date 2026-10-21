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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXhpc0xpbmVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vY2xpZW50L3NyYy9yZW5kZXJpbmcvbGliL2VkaXRvci9BeGlzTGluZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQTRCLHNCQUFzQixFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFXOUgsTUFBTSxPQUFPLFNBQVUsU0FBUSxZQUE0QztJQUMxRSxZQUFtQixFQUFFLE1BQU0sR0FBRyxRQUFRLEVBQUUsTUFBTSxHQUFHLFFBQVEsRUFBRSxNQUFNLEdBQUcsUUFBUSxFQUFFLEtBQUssR0FBRyxJQUFJLEVBQUUsWUFBWSxHQUFHLEdBQUcsRUFBRSxZQUFZLEdBQUcsQ0FBQyxFQUFFLEdBQXFCLEVBQUU7UUFDeEosTUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QixNQUFNLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QixNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUUsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNYLE1BQU0sQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzVCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUN0QyxRQUFRLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxJQUFJLHNCQUFzQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVFLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLElBQUksc0JBQXNCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFdEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxjQUFjLENBQUM7WUFDbkMsV0FBVyxFQUFFLElBQUk7WUFDakIsVUFBVSxFQUFFLEtBQUs7WUFDakIsUUFBUSxFQUFFO2dCQUNULGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUU7Z0JBQ3RDLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUU7YUFDdEM7WUFFRCxZQUFZLEVBQWE7Ozs7Ozs7Ozs7OztNQVl0QjtZQUVILGNBQWMsRUFBYTs7Ozs7Ozs7O01BU3hCO1NBQ0gsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUUxQixJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztRQUMzQixJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztJQUN0QixDQUFDO0lBRUQsSUFBVyxRQUFRO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7SUFDL0IsQ0FBQztDQUNEIn0=