import type { Loader } from "three";

export type RequestOptions = {
	readonly crossOrigin?: string;
	/** Sent with every request, like an authorization token for a private CDN. */
	readonly headers?: Readonly<Record<string, string>>;
};

export function applyRequestOptions(loader: Pick<Loader, "setCrossOrigin" | "setRequestHeader">, { crossOrigin, headers }: RequestOptions): void {
	if (crossOrigin !== undefined) {
		loader.setCrossOrigin(crossOrigin);
	}

	if (headers !== undefined) {
		loader.setRequestHeader({ ...headers });
	}
}
