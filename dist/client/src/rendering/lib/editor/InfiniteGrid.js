import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from "three";
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
                uFadeDistance: { value: fadeDistance },
                uFadeStrength: { value: fadeStrength },
            },
            vertexShader: `
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
            fragmentShader: `
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
    get uniforms() {
        return this.material.uniforms;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW5maW5pdGVHcmlkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vY2xpZW50L3NyYy9yZW5kZXJpbmcvbGliL2VkaXRvci9JbmZpbml0ZUdyaWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLEtBQUssRUFBNEIsVUFBVSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBcUJ6RyxNQUFNLE9BQU8sWUFBYSxTQUFRLElBQW1DO0lBQ3BFLFlBQW1CLEVBQUUsU0FBUyxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsRUFBRSxFQUFFLEtBQUssR0FBRyxRQUFRLEVBQUUsWUFBWSxHQUFHLEdBQUcsRUFBRSxZQUFZLEdBQUcsR0FBRyxFQUFFLFlBQVksR0FBRyxDQUFDLEVBQUUsR0FBd0IsRUFBRTtRQUN6SixNQUFNLFFBQVEsR0FBRyxJQUFJLGNBQWMsQ0FBQztZQUNuQyxXQUFXLEVBQUUsSUFBSTtZQUNqQixVQUFVLEVBQUUsS0FBSztZQUNqQixJQUFJLEVBQUUsVUFBVTtZQUNoQixRQUFRLEVBQUU7Z0JBQ1QsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRTtnQkFDaEMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRTtnQkFDaEMsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNuQyxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFO2dCQUN0QyxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFO2dCQUN0QyxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFO2FBQ3RDO1lBRUQsWUFBWSxFQUFhOzs7Ozs7Ozs7Ozs7TUFZdEI7WUFFSCxjQUFjLEVBQWE7Ozs7Ozs7Ozs7Ozs7Ozs7OztNQWtCeEI7U0FDSCxDQUFDLENBQUM7UUFFSCxLQUFLLENBQUMsSUFBSSxhQUFhLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRXpDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7SUFDNUIsQ0FBQztJQUdELElBQVcsUUFBUTtRQUNsQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO0lBQy9CLENBQUM7Q0FDRCJ9