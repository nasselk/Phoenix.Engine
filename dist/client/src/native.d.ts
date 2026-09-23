export type NativeOptions = {
    readonly target?: Document | HTMLElement;
    readonly contextMenu?: boolean;
    readonly zoom?: boolean;
    readonly drag?: boolean;
    readonly viewport?: boolean;
};
export declare function native(options?: NativeOptions): () => void;
