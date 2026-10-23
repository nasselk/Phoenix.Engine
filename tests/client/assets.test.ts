import { describe, expect, test } from "bun:test";
import { Group, Mesh, MeshStandardMaterial, Texture, type WebGLRenderer } from "three";
import { AssetManager } from "../../client/src/assets/AssetManager";

function gpu(maxAnisotropy: number): WebGLRenderer {
	return { capabilities: { getMaxAnisotropy: () => maxAnisotropy } } as unknown as WebGLRenderer;
}

function model(texture: Texture): Group {
	const group = new Group();

	group.add(new Mesh(undefined, new MeshStandardMaterial({ map: texture })));

	return group;
}

describe("AssetManager", () => {
	test("anisotropy reaches cached textures, the textures of cached models and materials, and what loads later, capped at the GPU's limit, 1 on a GPU without it", async () => {
		const assets = new AssetManager();
		const texture = new Texture();
		const inModel = new Texture();
		const inMaterial = new Texture();

		assets.cache.set("texture", "plain", texture);
		assets.cache.set("model", "crate", model(inModel));
		assets.cache.set("material", "wood", new MeshStandardMaterial({ map: inMaterial }));

		assets.anisotropy = 8;

		expect(assets.anisotropy).toBe(1);
		expect(texture.anisotropy).toBe(1);

		assets.init(gpu(4));

		expect(assets.maxAnisotropy).toBe(4);
		expect(assets.anisotropy).toBe(4);
		expect([texture.anisotropy, inModel.anisotropy, inMaterial.anisotropy]).toEqual([4, 4, 4]);
		expect(texture.version).toBeGreaterThan(0);

		const later = new Texture();

		assets.register("texture", { load: async () => later });
		await assets.load("texture", "later", "later.png");

		expect(later.anisotropy).toBe(4);

		assets.anisotropy = 2;

		expect([texture.anisotropy, inModel.anisotropy, inMaterial.anisotropy, later.anisotropy]).toEqual([2, 2, 2, 2]);

		const without = new AssetManager();

		without.anisotropy = 8;
		without.init(gpu(0));

		expect([without.maxAnisotropy, without.anisotropy]).toEqual([1, 1]);
	});
});
