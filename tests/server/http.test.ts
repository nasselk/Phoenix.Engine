import { describe, expect, test } from "bun:test";
import type { BunRequest } from "bun";
import { HttpGate } from "../../server/src/networking/http";

function gate(origins: string[] | string, maxRequestRate = Infinity) {
	return new HttpGate({ origins, proxied: false, maxRequestRate, address: () => "1.2.3.4" });
}

function request(origin: string, method = "GET"): BunRequest {
	return new Request("http://localhost/ping", { method, headers: { origin } }) as unknown as BunRequest;
}

const ok = () => new Response("ok");

describe("HttpGate", () => {
	test("only allowed origins get through, with their CORS headers", async () => {
		const route = gate(["https://*.example.com", "*://localhost:5173"]).route(ok);

		const allowed = await route(request("https://play.example.com"));

		expect(allowed.status).toBe(200);
		expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://play.example.com");
		expect((await route(request("http://localhost:5173"))).status).toBe(200);
		expect((await route(request("https://evil.com"))).status).toBe(403);
	});

	test("an origin pattern is literal apart from its wildcards", async () => {
		expect((await gate("https://a.b").route(ok)(request("https://aXb"))).status).toBe(403);
		expect((await gate("https://*.example.com").route(ok)(request("https://exampleXcom"))).status).toBe(403);
	});

	test("over the request rate, 429 until the rates reset", async () => {
		const http = gate("*", 2);
		const route = http.route(ok);

		expect((await route(request("x"))).status).toBe(200);
		expect((await route(request("x"))).status).toBe(200);
		expect((await route(request("x"))).status).toBe(429);

		http.resetRates();
		expect((await route(request("x"))).status).toBe(200);
	});

	test("a handler that throws answers 500", async () => {
		const route = gate("*").route(() => {
			throw new Error("boom");
		});

		expect((await route(request("x"))).status).toBe(500);
	});
});
