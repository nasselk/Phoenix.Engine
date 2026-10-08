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
 * What every HTTP request goes through: the allowed origins and their CORS headers, a per-IP request
 * rate, the JSON body, and a 500 instead of a crash when the handler throws. The socket upgrade goes
 * through `refuse` too, since browsers apply no CORS to WebSockets.
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
			const refusal = this.refuse(request);

			if (refusal) {
				return refusal;
			}

			const response = await this.invoke(handler, request);

			response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") ?? "");
			response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			response.headers.set("Access-Control-Allow-Headers", "Content-Type");
			response.headers.set("Access-Control-Allow-Credentials", "true");

			return response;
		};
	}

	/** A 403 for an origin that is not allowed, a 429 past the request rate, or undefined when the request may go through. Counts toward the rate. */
	public refuse(request: BunRequest): Response | undefined {
		const origin = request.headers.get("origin") ?? "";

		if (!this.origins.some((regex) => regex.test(origin))) {
			return new Response("Forbidden", { status: 403 });
		}

		if (this.requests.increment(this.ip(request)) > this.options.maxRequestRate) {
			return new Response("Too many requests", { status: 429 });
		}

		return undefined;
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
