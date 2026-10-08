import { describe, expect, test } from "bun:test";
import { NetworkSystem } from "../server/src/networking/NetworkSystem";

function createNetwork() {
	return new NetworkSystem({ in: { events: ["chat", "move"] as const } });
}

describe("onMessage", () => {
	test("a second handler for the same event throws instead of replacing the first", () => {
		const network = createNetwork();

		network.onMessage("chat", () => {});

		expect(() => network.onMessage("chat", () => {})).toThrow('"chat" already has a handler');
		expect(() => network.onMessage("move", () => {})).not.toThrow();
	});

	test("removing a handler frees the event for another", () => {
		const network = createNetwork();
		const remove = network.onMessage("chat", () => {});

		remove();

		expect(() => network.onMessage("chat", () => {})).not.toThrow();
	});

	test("a stale remover leaves the handler registered after it alone", () => {
		const network = createNetwork();
		const remove = network.onMessage("chat", () => {});

		remove();
		network.onMessage("chat", () => {});
		remove();

		expect(() => network.onMessage("chat", () => {})).toThrow();
	});
});
