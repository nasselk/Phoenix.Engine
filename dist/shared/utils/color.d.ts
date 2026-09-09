export declare function getRandomColor(r?: boolean, g?: boolean, b?: boolean, alpha?: boolean): string;
export declare function hexToRgba(hex: string, alpha?: number): string;
export declare function rgbaToHex(rgba: string): string;
export declare function isRGBA(rgba: string): boolean;
export declare function isHexColor(hex: string): boolean;
export declare function extractRGBA(rgba: string): {
    r: number;
    g: number;
    b: number;
    a: number;
} | null;
