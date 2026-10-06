import { BatchedMesh, Object3D } from "three";
export declare class Batcher {
    private readonly batches;
    batch(root: Object3D): BatchedMesh[];
    destroy(): void;
    private static layout;
    private static part;
    private static batchable;
}
