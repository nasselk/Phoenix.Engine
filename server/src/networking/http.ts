import type { BunRequest } from "bun";
import { CounterMap } from "../../../shared/utils/CounterMap";
import { warn } from "../../../shared/utils/logger";

/** What a route handler gets: the client's address, and its JSON body for a POST. */
export type RequestState = {
	readonly ip: string;
	readonly data: unknown;
};

export type RouteHandler = (state: RequestState, request: BunRequest) => Response | Promise<Response>;

export type HttpGateOptions = {
	readonly origins: string[] | string;
	/** Take the address from the last `X-Forwarded-For` entry, the one a single reverse proxy appended. */
	readonly proxied: boolean;
	/** Requests per IP per second. Over it, 429. */
	readonly maxRequestRate: number;
	/** The socket's own address, when no proxy header applies. */
	readonly address: (request: BunRequest) => string | undefined;
};

/**
 * What every HTTP route goes through before its handler: the allowed origins and their CORS headers,
 * a per-IP request rate, the JSON body, and a 500 instead of a crash when the handler throws.
 */
export class HttpGate {
	private readonly origins: RegExp[];
	private readonly requests = new CounterMap<string>();

	public constructor(private readonly options: HttpGateOptions) {
		this.origins = HttpGate.compileOrigins(options.origins);
	}

	/** Wrap a handler with the checks above. */
	public route(handler: RouteHandler): (request: BunRequest) => Promise<Response> {
		return async (request: BunRequest): Promise<Response> => {
			const cors = this.corsHeaders(request.headers.get("origin") ?? "");

			if (!cors) {
				return new Response("Forbidden", { status: 403 });
			}

			const response = await this.invoke(handler, request);

			for (const key in cors) {
				response.headers.set(key, cors[key]!);
			}

			return response;
		};
	}

	/** The answer to a CORS preflight. */
	public preflight(): (request: BunRequest) => Promise<Response> {
		return this.route(() => new Response(null, { status: 204 }));
	}

	/** The client's address: the proxy's header when `proxied`, the socket's otherwise. */
	public ip(request: BunRequest): string {
		if (this.options.proxied) {
			const forwarded = request.headers.get("X-Forwarded-For")?.split(",").at(-1)?.trim();

			if (forwarded) {
				return forwarded;
			}
		}

		return this.options.address(request) ?? "";
	}

	/** Start a new second for the request rate. */
	public resetRates(): void {
		this.requests.clear();
	}

	private async invoke(handler: RouteHandler, request: BunRequest): Promise<Response> {
		const ip = this.ip(request);

		if (this.requests.increment(ip) > this.options.maxRequestRate) {
			return new Response("Too many requests", { status: 429 });
		}

		let data: unknown;

		if (request.method === "POST") {
			try {
				const body = await request.text();

				data = body.length > 0 ? JSON.parse(body) : {};
			} catch {
				return new Response("Invalid JSON", { status: 400 });
			}
		}

		try {
			return await handler({ ip, data }, request);
		} catch (err) {
			warn("Networking Server", "Unhandled error in HTTP handler:", err);

			return new Response("Internal Server Error", { status: 500 });
		}
	}

	/** The CORS headers for an allowed origin, or `null` when it is not allowed. */
	private corsHeaders(origin: string): Record<string, string> | null {
		if (!this.origins.some((regex) => regex.test(origin))) {
			return null;
		}

		return {
			"Access-Control-Allow-Origin": origin,
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			"Access-Control-Allow-Credentials": "true",
		};
	}

	/** `*` is any run of characters, `*://` any of http and https; everything else matches itself. */
	private static compileOrigins(origins: string[] | string): RegExp[] {
		const list = Array.isArray(origins) ? origins : [origins];

		if (list.includes("*")) {
			return [/.*/];
		}

		return list.map((origin) => {
			const scheme = origin.startsWith("*://") ? "(http|https)://" : "";
			const rest = scheme ? origin.slice(4) : origin;
			const pattern = rest
				.split("*")
				.map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, "\\$&"))
				.join(".*");

			return new RegExp(`^${scheme}${pattern}$`, "i");
		});
	}
}
