import { BatchedMesh, BufferAttribute, BufferGeometry, Matrix4, Mesh, Object3D } from "three";
export class Batcher {
    constructor() {
        this.batches = new Map();
    }
    batch(root) {
        root.updateMatrixWorld(true);
        const toRoot = new Matrix4().copy(root.matrixWorld).invert();
        const meshes = [];
        root.traverseVisible((object) => {
            if (object !== root && Batcher.batchable(object)) {
                meshes.push(object);
            }
        });
        const buckets = new Map();
        const slices = new Map();
        for (const mesh of meshes) {
            const geometry = mesh.geometry;
            const matrix = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
            const materials = mesh.material;
            const pieces = [];
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
            }
            else {
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
        const batches = [];
        for (const { material, castShadow, receiveShadow, parts } of buckets.values()) {
            const unique = new Map();
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
            const ids = new Map();
            for (const [geometryKey, geometry] of unique) {
                ids.set(geometryKey, batched.addGeometry(geometry));
            }
            for (const { geometryKey, matrix } of parts) {
                batched.setMatrixAt(batched.addInstance(ids.get(geometryKey)), matrix);
            }
            batched.castShadow = castShadow;
            batched.receiveShadow = receiveShadow;
            root.add(batched);
            batches.push(batched);
        }
        for (const geometry of slices.values()) {
            geometry.dispose();
        }
        const stands = [];
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
    destroy() {
        for (const made of this.batches.values()) {
            for (const batched of made) {
                batched.removeFromParent();
                batched.dispose();
            }
        }
        this.batches.clear();
    }
    static layout(geometry) {
        const attributes = Object.keys(geometry.attributes)
            .sort()
            .map((name) => {
            const attribute = geometry.getAttribute(name);
            return `${name}:${attribute.itemSize}:${attribute.normalized}`;
        });
        return `${attributes.join(",")}|${geometry.index === null ? "flat" : "indexed"}`;
    }
    static part(geometry, start, count) {
        const slice = new BufferGeometry();
        if (geometry.index !== null) {
            for (const [name, attribute] of Object.entries(geometry.attributes)) {
                slice.setAttribute(name, attribute);
            }
            slice.setIndex(new BufferAttribute(geometry.index.array.slice(start, start + count), 1));
        }
        else {
            for (const [name, attribute] of Object.entries(geometry.attributes)) {
                const size = attribute.itemSize;
                slice.setAttribute(name, new BufferAttribute(attribute.array.slice(start * size, (start + count) * size), size, attribute.normalized));
            }
        }
        return slice;
    }
    static batchable(object) {
        if (!(object instanceof Mesh) || object.constructor !== Mesh || object.userData.batch === false) {
            return false;
        }
        const geometry = object.geometry;
        return geometry.getAttribute("position") !== undefined && Object.keys(geometry.morphAttributes).length === 0;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmF0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL2NsaWVudC9zcmMvcmVuZGVyaW5nL2xpYi9CYXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBaUIsT0FBTyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFtQjdHLE1BQU0sT0FBTyxPQUFPO0lBQXBCO1FBRWtCLFlBQU8sR0FBRyxJQUFJLEdBQUcsRUFBMkIsQ0FBQztJQTZNL0QsQ0FBQztJQTdMTyxLQUFLLENBQUMsSUFBYztRQUMxQixJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0IsTUFBTSxNQUFNLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzdELE1BQU0sTUFBTSxHQUFXLEVBQUUsQ0FBQztRQUUxQixJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDL0IsSUFBSSxNQUFNLEtBQUssSUFBSSxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDbEQsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUMxQyxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBMEIsQ0FBQztRQUVqRCxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQzNCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUEwQixDQUFDO1lBQ2pELE1BQU0sTUFBTSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUMs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