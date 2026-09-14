import { Vector3 } from "../../../../shared/libs/math/vector3D";
const center = new Vector3();
const otherCenter = new Vector3();
export function collideBoxBox(a, b) {
    a.center(center);
    b.center(otherCenter);
    const dx = otherCenter.x - center.x;
    const px = a.halfExtents.x + b.halfExtents.x - Math.abs(dx);
    if (px <= 0) {
        return undefined;
    }
    const dy = otherCenter.y - center.y;
    const py = a.halfExtents.y + b.halfExtents.y - Math.abs(dy);
    if (py <= 0) {
        return undefined;
    }
    const dz = otherCenter.z - center.z;
    const pz = a.halfExtents.z + b.halfExtents.z - Math.abs(dz);
    if (pz <= 0) {
        return undefined;
    }
    if (px <= py && px <= pz) {
        return { normal: new Vector3(dx > 0 ? -1 : 1, 0, 0), depth: px };
    }
    if (py <= pz) {
        return { normal: new Vector3(0, dy > 0 ? -1 : 1, 0), depth: py };
    }
    return { normal: new Vector3(0, 0, dz > 0 ? -1 : 1), depth: pz };
}
