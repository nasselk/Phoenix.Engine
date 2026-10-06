import { BufferAttribute, BufferGeometry, Group, type Material, Matrix4, Mesh, type Object3D } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** The attributes every batched geometry keeps: anything else would stop two geometries from merging. */
const ATTRIBUTES = ["position", "normal", "uv"] as const;

const relative = new Matrix4();

/** The part of a non-indexed geometry that a group covers, as a geometry of its own. */
function slice(geometry: BufferGeometry, start: number, count: number): BufferGeometry {
	const part = new BufferGeometry();

	for (const name of ATTRIBUTES) {
		const attribute = geometry.attributes[name]!;
		const size = attribute.itemSize;

		part.setAttribute(name, new BufferAttribute((attribute.array as Float32Array).slice(start * size, (start + count) * size), size));
	}

	return part;
}

/**
 * Everything under `root` that never moves, merged into one mesh per material: a scene of hundreds of
 * props becomes a handful of draw calls. Each mesh is baked where it stands relative to `root`; a mesh
 * with several materials is split along its groups first. Only meshes whose geometry has positions,
 * normals and UVs, and whose materials use no vertex colours, are merged; anything else (text, points,
 * painted models) stays as it is.
 */
export function batch(root: Object3D, { castShadow = true, receiveShadow = true } = {}): Group {
	const buckets = new Map<Material, BufferGeometry[]>();
	const kept: Object3D[] = [];

	root.updateMatrixWorld(true);
	relative.copy(root.matrixWorld).invert();

	root.traverse((object) => {
		if (!(object instanceof Mesh) || object.constructor !== Mesh) {
			if (object !== root && !(object instanceof Group) && object.parent === root) {
				kept.push(object);
			}

			return;
		}

		const source = object.geometry as BufferGeometry;
		const painted = (Array.isArray(object.material) ? object.material : [object.material]).some((material: Material) => material.vertexColors);

		if (painted || !ATTRIBUTES.every((name) => source.attributes[name] !== undefined)) {
			kept.push(object);

			return;
		}

		const geometry = (source.index === null ? source.clone() : source.toNonIndexed()).applyMatrix4(new Matrix4().multiplyMatrices(relative, object.matrixWorld));
		const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
		const groups = Array.isArray(object.material) && geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count: geometry.attributes.position!.count, materialIndex: 0 }];

		for (const { start, count, materialIndex } of groups) {
			const material = materials[materialIndex ?? 0]!;
			const bucket = buckets.get(material) ?? [];

			bucket.push(slice(geometry, start, count));
			buckets.set(material, bucket);
		}

		geometry.dispose();
	});

	const batched = new Group();

	for (const [material, geometries] of buckets) {
		const merged = mergeGeometries(geometries, false);

		for (const geometry of geometries) {
			geometry.dispose();
		}

		if (merged === null) {
			continue;
		}

		const mesh = new Mesh(merged, material);

		mesh.castShadow = castShadow;
		mesh.receiveShadow = receiveShadow;
		batched.add(mesh);
	}

	for (const object of kept) {
		if (object instanceof Mesh && object.constructor === Mesh) {
			object.castShadow = castShadow;
			object.receiveShadow = receiveShadow;
		}

		batched.attach(object);
	}

	return batched;
}
