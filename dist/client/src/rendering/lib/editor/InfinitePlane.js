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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW5maW5pdGVQbGFuZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL2NsaWVudC9zcmMvcmVuZGVyaW5nL2xpYi9lZGl0b3IvSW5maW5pdGVQbGFuZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsS0FBSyxFQUE0QixVQUFVLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFVekcsTUFBTSxPQUFPLGFBQWMsU0FBUSxJQUFtQztJQUNyRSxZQUFtQixFQUFFLEtBQUssR0FBRyxRQUFRLEVBQUUsT0FBTyxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFFLFlBQVksR0FBRyxHQUFHLEVBQUUsWUFBWSxHQUFHLENBQUMsRUFBRSxHQUF5QixFQUFFO1FBQ2hJLE1BQU0sUUFBUSxHQUFHLElBQUksY0FBYyxDQUFDO1lBQ25DLFdBQVcsRUFBRSxJQUFJO1lBQ2pCLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLElBQUksRUFBRSxVQUFVO1lBQ2hCLFFBQVEsRUFBRTtnQkFDVCxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ25DLFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7Z0JBQzVCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUU7Z0JBQ3RDLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUU7YUFDdEM7WUFFRCxZQUFZLEVBQWE7Ozs7Ozs7Ozs7TUFVdEI7WUFFSCxjQUFjLEVBQWE7Ozs7Ozs7OztNQVN4QjtTQUNILENBQUMsQ0FBQztRQUVILEtBQUssQ0FBQyxJQUFJLGFBQWEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFekMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7UUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7UUFDM0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRUQsSUFBVyxRQUFRO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7SUFDL0IsQ0FBQztDQUNEIn0=