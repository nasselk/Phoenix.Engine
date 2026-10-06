import { BatchedMesh, BufferAttribute, BufferGeometry, type Material, Matrix4, Mesh, Object3D } from "three";

type Part = {
	readonly geometry: BufferGeometry;
	readonly geometryKey: string;
	readonly matrix: Matrix4;
};

type Bucket = {
	readonly material: Material;
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
	readonly parts: Part[];
};

/**
 * Draws static scenery in few draw calls, and frees what it made when the renderer goes. Reached as
 * `engine.renderer.batcher`.
 */
export class Batcher {
	/** Every batch made so far, by the root it was made under. */
	private readonly batches = new Map<Object3D, BatchedMesh[]>();

	/**
	 * Draws every plain mesh under `root` that never moves in a few calls: one `BatchedMesh` per material,
	 * shadow setting and geometry layout, added to `root`. Each distinct geometry is stored once and every
	 * mesh using it becomes an instance, which keeps its own culling, visibility and raycast hit.
	 *
	 * In place: the batched meshes leave the scene, and everything else stays where it was — sprites,
	 * text, invisible objects, other kinds of mesh, and anything with `userData.batch = false`. A batched
	 * mesh's children stay too, under an empty object standing where the mesh stood.
	 *
	 * For scenery only: a batched mesh no longer exists, so moving it afterwards does nothing. The
	 * batches are freed with the renderer.
	 *
	 * @returns The batches it made.
	 */
	public batch(root: Object3D): BatchedMesh[] {
		root.updateMatrixWorld(true);

		const toRoot = new Matrix4().copy(root.matrixWorld).invert();
		const meshes: Mesh[] = [];

		root.traverseVisible((object) => {
			if (object !== root && Batcher.batchable(object)) {
				meshes.push(object);
			}
		});

		const buckets = new Map<string, Bucket>();
		const slices = new Map<string, BufferGeometry>();

		for (const mesh of meshes) {
			const geometry = mesh.geometry as BufferGeometry;
			const matrix = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
			const materials = mesh.material;
			const pieces: { material: Material; geometry: BufferGeometry; geometryKey: string }[] = [];

			if (Array.isArray(materials)) {
				geometry.groups.forEach((group, index) => {
					const material = materials[group.materialIndex ?? 0];

					if (material === undefined) {
						return;
					}

					const geometryKey = `${geometry.uuid}:${index}`;
					let slice = slices.get(geometryKey);

					if (slice === undefined) {
						slice = Batcher.part(geometry, group.start, group.count);
						slices.set(geometryKey, slice);
					}

					pieces.push({ material, geometry: slice, geometryKey });
				});
			} else {
				pieces.push({ material: materials, geometry, geometryKey: geometry.uuid });
			}

			for (const piece of pieces) {
				const key = `${piece.material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${Batcher.layout(piece.geometry)}`;
				let bucket = buckets.get(key);

				if (bucket === undefined) {
					bucket = { material: piece.material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, parts: [] };
					buckets.set(key, bucket);
				}

				bucket.parts.push({ geometry: piece.geometry, geometryKey: piece.geometryKey, matrix });
			}
		}

		const batches: BatchedMesh[] = [];

		for (const { material, castShadow, receiveShadow, parts } of buckets.values()) {
			const unique = new Map<string, BufferGeometry>();

			for (const { geometryKey, geometry } of parts) {
				unique.set(geometryKey, geometry);
			}

			let vertices = 0;
			let indices = 0;

			for (const geometry of unique.values()) {
				vertices += geometry.getAttribute("position").count;
				indices += geometry.index?.count ?? 0;
			}

			const batched = new BatchedMesh(parts.length, vertices, indices, material);
			const ids = new Map<string, number>();

			for (const [geometryKey, geometry] of unique) {
				ids.set(geometryKey, batched.addGeometry(geometry));
			}

			for (const { geometryKey, matrix } of parts) {
				batched.setMatrixAt(batched.addInstance(ids.get(geometryKey)!), matrix);
			}

			batched.castShadow = castShadow;
			batched.receiveShadow = receiveShadow;

			root.add(batched);
			batches.push(batched);
		}

		for (const geometry of slices.values()) {
			geometry.dispose();
		}

		const stands: Object3D[] = [];

		for (const mesh of meshes) {
			const parent = mesh.parent;

			if (parent === null) {
				continue;
			}

			if (mesh.children.length > 0) {
				const stand = new Object3D();

				stand.name = mesh.name;
				stand.position.copy(mesh.position);
				stand.quaternion.copy(mesh.quaternion);
				stand.scale.copy(mesh.scale);

				for (const child of [...mesh.children]) {
					stand.add(child);
				}

				parent.add(stand);
				stands.push(stand);
			}

			parent.remove(mesh);
		}

		for (const stand of stands) {
			if (stand.children.length === 0) {
				stand.removeFromParent();
			}
		}

		this.batches.set(root, [...(this.batches.get(root) ?? []), ...batches]);

		return batches;
	}

	/** Frees every batch it made. The renderer calls it when it is destroyed. */
	public destroy(): void {
		for (const made of this.batches.values()) {
			for (const batched of made) {
				batched.removeFromParent();
				batched.dispose();
			}
		}

		this.batches.clear();
	}

	/** What every geometry sharing a batch must agree on: the same attributes, laid out the same way, and an index or none. */
	private static layout(geometry: BufferGeometry): string {
		const attributes = Object.keys(geometry.attributes)
			.sort()
			.map((name) => {
				const attribute = geometry.getAttribute(name);

				return `${name}:${attribute.itemSize}:${attribute.normalized}`;
			});

		return `${attributes.join(",")}|${geometry.index === null ? "flat" : "indexed"}`;
	}

	/** The part of a geometry one material group draws, as a geometry of its own. */
	private static part(geometry: BufferGeometry, start: number, count: number): BufferGeometry {
		const slice = new BufferGeometry();

		if (geometry.index !== null) {
			for (const [name, attribute] of Object.entries(geometry.attributes)) {
				slice.setAttribute(name, attribute);
			}

			slice.setIndex(new BufferAttribute(geometry.index.array.slice(start, start + count), 1));
		} else {
			for (const [name, attribute] of Object.entries(geometry.attributes)) {
				const size = attribute.itemSize;

				slice.setAttribute(name, new BufferAttribute(attribute.array.slice(start * size, (start + count) * size), size, attribute.normalized));
			}
		}

		return slice;
	}

	private static batchable(object: Object3D): object is Mesh {
		if (!(object instanceof Mesh) || object.constructor !== Mesh || object.userData.batch === false) {
			return false;
		}

		const geometry = object.geometry as BufferGeometry;

		return geometry.getAttribute("position") !== undefined && Object.keys(geometry.morphAttributes).length === 0;
	}
}
