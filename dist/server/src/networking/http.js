import { CounterMap } from "../../../shared/utils/CounterMap";
import { warn } from "../../../shared/utils/logger";
export class HttpGate {
    constructor(options) {
        this.options = options;
        this.requests = new CounterMap();
        this.origins = HttpGate.compileOrigins(options.origins);
    }
    route(handler) {
        return async (request) => {
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
    refuse(request) {
        const origin = request.headers.get("origin") ?? "";
        if (!this.origins.some((regex) => regex.test(origin))) {
            return new Response("Forbidden", { status: 403 });
        }
        if (this.requests.increment(this.ip(request)) > this.options.maxRequestRate) {
            return new Response("Too many requests", { status: 429 });
        }
        return undefined;
    }
    preflight() {
        return this.route(() => new Response(null, { status: 204 }));
    }
    ip(request) {
        if (this.options.proxied) {
            const forwarded = request.headers.get("X-Forwarded-For")?.split(",").at(-1)?.trim();
            if (forwarded) {
                return forwarded;
            }
        }
        return this.options.address(request) ?? "";
    }
    resetRates() {
        this.requests.clear();
    }
    async invoke(handler, request) {
        const ip = this.ip(request);
        let data;
        if (request.method === "POST") {
            try {
                const body = await request.text();
                data = body.length > 0 ? JSON.parse(body) : {};
            }
            catch {
                return new Response("Invalid JSON", { status: 400 });
            }
        }
        try {
            return await handler({ ip, data }, request);
        }
        catch (err) {
            warn("Networking Server", "Unhandled error in HTTP handler:", err);
            return new Response("Internal Server Error", { status: 500 });
        }
    }
    static compileOrigins(origins) {
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
