import { describe, expect, test } from "bun:test";
import { BatchedMesh, BoxGeometry, BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, Object3D, Sprite, Vector3 } from "three";
import { Batcher } from "../../client/src/rendering/lib/Batcher";

function batch(root: Object3D): BatchedMesh[] {
	return new Batcher().batch(root);
}

function batchesIn(root: Object3D): BatchedMesh[] {
	return root.children.filter((child): child is BatchedMesh => child instanceof BatchedMesh);
}

function meshesIn(root: Object3D): Mesh[] {
	const meshes: Mesh[] = [];

	root.traverse((object) => {
		if (object instanceof Mesh && object.constructor === Mesh) {
			meshes.push(object);
		}
	});

	return meshes;
}

describe("Batcher", () => {
	test("meshes sharing a material become instances of one batch, each geometry stored once", () => {
		const root = new Group();
		const box = new BoxGeometry();
		const wood = new MeshBasicMaterial();
		const shelf = new Group();

		shelf.position.set(10, 0, 0);
		root.add(shelf);

		for (let i = 0; i < 3; i++) {
			const crate = new Mesh(box, wood);

			crate.position.set(i * 2, 0, 0);
			shelf.add(crate);
		}

		const [batched] = batch(root);

		expect(batchesIn(root)).toHaveLength(1);
		expect(batched!.instanceCount).toBe(3);
		expect(batched!.maxInstanceCount).toBe(3);
		expect(meshesIn(root)).toHaveLength(0);

		const matrix = new Matrix4();

		batched!.getMatrixAt(2, matrix);

		expect(new Vector3().setFromMatrixPosition(matrix).x).toBe(14);
	});

	test("a sprite or label inside a batched mesh stays where it was in the world", () => {
		const root = new Group();
		const crate = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
		const label = new Sprite();

		crate.position.set(3, 1, -2);
		label.position.set(0, 2, 0);
		crate.add(label);
		root.add(crate);
		root.updateMatrixWorld(true);

		const before = label.getWorldPosition(new Vector3());

		batch(root);
		root.updateMatrixWorld(true);

		expect(label.parent).not.toBeNull();
		expect(label.getWorldPosition(new Vector3()).toArray()).toEqual(before.toArray());
	});

	test("vertex-coloured meshes are batched too, apart from plain ones", () => {
		const root = new Group();
		const material = new MeshBasicMaterial({ vertexColors: true });
		const painted = new BoxGeometry();

		painted.setAttribute("color", new BufferAttribute(new Float32Array(painted.getAttribute("position").count * 3).fill(1), 3));

		root.add(new Mesh(painted, material), new Mesh(painted, material), new Mesh(new BoxGeometry(), material));

		const batches = batch(root);

		expect(batches).toHaveLength(2);
		expect(batches.map((batched) => batched.instanceCount).sort()).toEqual([1, 2]);
	});

	test("a mesh with several materials is split by material", () => {
		const root = new Group();
		const faces = Array.from({ length: 6 }, (_, i) => new MeshBasicMaterial({ color: i % 2 === 0 ? 0xff0000 : 0x0000ff }));

		root.add(new Mesh(new BoxGeometry(), faces));

		expect(batch(root)).toHaveLength(6);
	});

	test("leaves invisible meshes, other kinds of mesh and opted-out meshes alone", () => {
		const root = new Group();
		const material = new MeshBasicMaterial();
		const hidden = new Mesh(new BoxGeometry(), material);
		const kept = new Mesh(new BoxGeometry(), material);

		class Special extends Mesh {}

		const special = new Special(new BoxGeometry(), material);

		hidden.visible = false;
		kept.userData.batch = false;
		root.add(hidden, kept, special, new Mesh(new BoxGeometry(), material));

		const batches = batch(root);

		expect(batches).toHaveLength(1);
		expect(batches[0]!.instanceCount).toBe(1);
		expect(hidden.parent).toBe(root);
		expect(kept.parent).toBe(root);
		expect(special.parent).toBe(root);
	});

	test("keeps each mesh's shadow settings", () => {
		const root = new Group();
		const material = new MeshBasicMaterial();
		const caster = new Mesh(new BoxGeometry(), material);
		const flat = new Mesh(new BoxGeometry(), material);

		caster.castShadow = true;
		root.add(caster, flat);

		const batches = batch(root);

		expect(batches).toHaveLength(2);
		expect(batches.map((batched) => batched.castShadow).sort()).toEqual([false, true]);
	});

	test("destroying the batcher frees and removes every batch it made, across roots", () => {
		const batcher = new Batcher();
		const level = new Group();
		const props = new Group();
		const material = new MeshBasicMaterial();

		level.add(new Mesh(new BoxGeometry(), material));
		props.add(new Mesh(new BoxGeometry(), material));

		const made = [...batcher.batch(level), ...batcher.batch(props)];
		let disposed = 0;

		for (const batched of made) {
			batched.addEventListener("dispose", () => disposed++);
		}

		batcher.destroy();

		expect(disposed).toBe(2);
		expect(batchesIn(level)).toHaveLength(0);
		expect(batchesIn(props)).toHaveLength(0);
	});
});
