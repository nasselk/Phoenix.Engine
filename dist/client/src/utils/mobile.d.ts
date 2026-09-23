export type DeviceType = {
    readonly mobile: boolean;
    readonly tablet: boolean;
    readonly any: boolean;
};
export declare function isMobileDevice(): DeviceType;
