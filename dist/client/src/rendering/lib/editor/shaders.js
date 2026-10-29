export function fadeUniforms(distance, strength) {
    return { uFadeDistance: { value: distance }, uFadeStrength: { value: strength } };
}
export const FADE = `
	uniform float uFadeDistance, uFadeStrength;

	float fade(float away) {
		return pow(1.0 - min(away / uFadeDistance, 1.0), uFadeStrength);
	}
`;
export const FOLLOW_VERTEX = `
	uniform float uFadeDistance;
	varying vec3 vWorld;

	void main() {
		vec3 p = position * uFadeDistance * 2.0;
		// After the rotation, local Y is world -Z.
		p.x += cameraPosition.x;
		p.y -= cameraPosition.z;
		vec4 world = modelMatrix * vec4(p, 1.0);
		vWorld = world.xyz;
		gl_Position = projectionMatrix * viewMatrix * world;
	}
`;
//# sourceMappingURL=shaders.js.map