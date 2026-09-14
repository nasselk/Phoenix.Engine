import { collideBoxBox } from "./boxBox";
import { collideBoxPlane } from "./boxPlane";
import { ColliderKind } from "./kind";
export function collide(a, b) {
    if (a.kind === ColliderKind.Box) {
        if (b.kind === ColliderKind.Box) {
            return collideBoxBox(a, b);
        }
        return collideBoxPlane(a, b);
    }
    if (b.kind === ColliderKind.Box) {
        const collision = collideBoxPlane(b, a);
        return collision === undefined ? undefined : { normal: collision.normal.scale(-1), depth: collision.depth };
    }
    return undefined;
}
