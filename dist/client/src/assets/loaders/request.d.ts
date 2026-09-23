import type { Loader } from "three";
export type RequestOptions = {
    readonly crossOrigin?: string;
    readonly headers?: Readonly<Record<string, string>>;
};
export declare function applyRequestOptions(loader: Pick<Loader, "setCrossOrigin" | "setRequestHeader">, { crossOrigin, headers }: RequestOptions): void;
