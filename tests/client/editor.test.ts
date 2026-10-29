import { describe, expect, test } from "bun:test";
import { DirectionalLight, Group, PointLight, Scene } from "three";
import { EditorView } from "../../client/src/rendering/lib/editor/EditorView";

/** An EditorView over a bare scene: the only part of the engine toggleShadows reaches. */
function createView(scene: Scene): EditorView {
	return new EditorView({ renderer: { scene } } as never);
}

describe("EditorView", () => {
	test("toggleShadows stops every light casting, and gives its shadows back to those lights only", () => {
		const scene = new Scene();
		const sun = new DirectionalLight();
		const lamp = new PointLight();
		const dark = new PointLight();
		const nested = new Group().add(lamp);

		sun.castShadow = true;
		lamp.castShadow = true;
		dark.castShadow = false;
		scene.add(sun, nested, dark);

		const view = createView(scene);

		view.toggleShadows(false);

		expect([sun.castShadow, lamp.castShadow, dark.castShadow]).toEqual([false, false, false]);

		view.toggleShadows(true);

		expect([sun.castShadow, lamp.castShadow, dark.castShadow]).toEqual([true, true, false]);
	});
});
