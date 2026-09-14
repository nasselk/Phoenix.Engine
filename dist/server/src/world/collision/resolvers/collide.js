import { collideBoxBox } from "./boxBox";
import { collideBoxPlane } from "./boxPlane";
export function collide(a, b) {
    if (a.kind === 0) {
        if (b.kind === 0) {
            return collideBoxBox(a, b);
        }
        return collideBoxPlane(a, b);
    }
    if (b.kind === 0) {
        const collision = collideBoxPlane(b, a);
        return collision === undefined ? undefined : { normal: collision.normal.scale(-1), depth: collision.depth };
    }
    return undefined;
}
