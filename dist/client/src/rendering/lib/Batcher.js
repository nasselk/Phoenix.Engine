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
