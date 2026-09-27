export type QuaternionStructure = {
    x: number;
    y: number;
    z: number;
    w: number;
};
export declare function eulerToQuaternion<Q extends QuaternionStructure>(pitch: number, yaw: number, roll: number, out: Q): Q;
export declare function quaternionToEuler({ x, y, z, w }: QuaternionStructure, out: [number, number, number]): [number, number, number];
declare class Quaternion {
    static readonly IDENTITY: Quaternion;
    static readonly TEMP1: Quaternion;
    static readonly TEMP2: Quaternion;
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    set(quaternion: QuaternionStructure): this;
    set(x: number, y: number, z: number, w: number): this;
    setFromEuler(pitch: number, yaw: number, roll: number): this;
    setFromYaw(yaw: number): this;
    setFromAxisAngle(axis: {
        x: number;
        y: number;
        z: number;
    }, angle: number): this;
    toEuler(out?: [number, number, number]): [number, number, number];
    get yaw(): number;
    dot(quaternion: QuaternionStructure): number;
    angleTo(quaternion: QuaternionStructure): number;
    equals(quaternion: QuaternionStructure, epsilon?: number): boolean;
    length(): number;
    normalize(): this;
    invert(): this;
    multiply(quaternion: QuaternionStructure): this;
    premultiply(quaternion: QuaternionStructure): this;
    slerp(target: QuaternionStructure, t: number): this;
    pack(): number;
    unpack(packed: number): this;
    clone(): Quaternion;
}
declare class ObservableQuaternion extends Quaternion {
    private readonly stored;
    constructor(x?: number, y?: number, z?: number, w?: number);
    store(): this;
    hasUpdated(minimumAngle?: number): boolean;
}
export { ObservableQuaternion, Quaternion };
