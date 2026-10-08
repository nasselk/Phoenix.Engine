import { describe, expect, test } from "bun:test";
import type { BunRequest } from "bun";
import { HttpGate } from "../server/src/networking/http";
import { SessionManager } from "../server/src/networking/sessions";
import { SESSION_SUBPROTOCOL, SESSION_TTL } from "../shared/networking/session";

describe("sessions", () => {
	test("a ticket opens one socket, once", () => {
		const sessions = new SessionManager();
		const { ticket, sessionID, allowReconnection } = sessions.issue(undefined);

		expect(allowReconnection).toBe(false);
		expect(sessions.redeem(ticket)).toEqual({ sessionID, reconnected: false });
		expect(sessions.redeem(ticket)).toBeUndefined();
	});

	test("a dropped session is given back to the client that held it", () => {
		const sessions = new SessionManager();
		const first = sessions.issue(undefined);

		sessions.redeem(first.ticket);
		sessions.connect(first.sessionID);
		sessions.disconnect(first.sessionID);

		const again = sessions.issue(first.sessionID);

		expect(again.sessionID).toBe(first.sessionID);
		expect(again.allowReconnection).toBe(true);
		expect(sessions.redeem(again.ticket)).toEqual({ sessionID: first.sessionID, reconnected: true });
	});

	test("a session still connected is never handed out again, and stays connected", () => {
		const sessions = new SessionManager();
		const first = sessions.issue(undefined);

		sessions.redeem(first.ticket);
		sessions.connect(first.sessionID);

		const copy = sessions.issue(first.sessionID);

		expect(copy.sessionID).not.toBe(first.sessionID);
		expect(copy.allowReconnection).toBe(false);
		expect(sessions.isConnected(first.sessionID)).toBe(true);

		sessions.sweep(Date.now() + SESSION_TTL * 10);
		expect(sessions.isConnected(first.sessionID)).toBe(true);
	});

	test("two tickets for one session open one socket", () => {
		const sessions = new SessionManager();
		const first = sessions.issue(undefined);

		sessions.redeem(first.ticket);
		sessions.connect(first.sessionID);
		sessions.disconnect(first.sessionID);

		const a = sessions.issue(first.sessionID);
		const b = sessions.issue(first.sessionID);

		expect(sessions.redeem(a.ticket)).toBeDefined();
		expect(sessions.connect(first.sessionID)).toBe(true);
		expect(sessions.redeem(b.ticket)).toBeUndefined();
		expect(sessions.connect(first.sessionID)).toBe(false);
	});

	test("a session dropped too long ago starts over", () => {
		const sessions = new SessionManager();
		const first = sessions.issue(undefined);

		sessions.redeem(first.ticket);
		sessions.connect(first.sessionID);
		sessions.disconnect(first.sessionID);
		sessions.sweep(Date.now() + SESSION_TTL + 1);

		const again = sessions.issue(first.sessionID);

		expect(again.sessionID).not.toBe(first.sessionID);
		expect(again.allowReconnection).toBe(false);
	});

	test("the ticket is the offered subprotocol that is not the session one", () => {
		const sessions = new SessionManager();

		expect(sessions.ticketFrom(`${SESSION_SUBPROTOCOL}, abc`)).toBe("abc");
		expect(sessions.ticketFrom("abc")).toBeUndefined();
		expect(sessions.ticketFrom(null)).toBeUndefined();
	});
});

describe("http gate", () => {
	function gate(origins: string[] | string, maxRequestRate = Infinity) {
		return new HttpGate({ origins, proxied: false, maxRequestRate, address: () => "1.2.3.4" });
	}

	function request(origin: string, method = "GET"): BunRequest {
		return new Request("http://localhost/ping", { method, headers: { origin } }) as unknown as BunRequest;
	}

	const ok = () => new Response("ok");

	test("only allowed origins get through, with their CORS headers", async () => {
		const route = gate(["https://*.example.com", "*://localhost:5173"]).route(ok);

		const allowed = await route(request("https://play.example.com"));

		expect(allowed.status).toBe(200);
		expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://play.example.com");
		expect((await route(request("http://localhost:5173"))).status).toBe(200);
		expect((await route(request("https://evil.com"))).status).toBe(403);
		expect((await route(request("https://exampleXcom"))).status).toBe(403);
	});

	test("a dot in an origin matches only a dot", async () => {
		const route = gate("https://a.b").route(ok);

		expect((await route(request("https://a.b"))).status).toBe(200);
		expect((await route(request("https://aXb"))).status).toBe(403);
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
