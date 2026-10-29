/** The uniforms behind `FADE`: how far from the camera a helper has faded out, and how soon. */
export function fadeUniforms(distance: number, strength: number) {
	return { uFadeDistance: { value: distance }, uFadeStrength: { value: strength } };
}

/** `fade(distance)`: 1 at the camera, down to 0 at `uFadeDistance`, along a curve of exponent `uFadeStrength`. */
export const FADE = /* glsl */ `
	uniform float uFadeDistance, uFadeStrength;

	float fade(float away) {
		return pow(1.0 - min(away / uFadeDistance, 1.0), uFadeStrength);
	}
`;

/**
 * A unit plane in local XY, laid flat by a -90° X rotation, stretched to reach the fade distance and
 * kept under the camera, so it never runs out. Passes its world position on as `vWorld`.
 */
export const FOLLOW_VERTEX = /* glsl */ `
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
