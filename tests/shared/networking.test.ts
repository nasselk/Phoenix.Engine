import { describe, expect, test } from "bun:test";
import { MessageHandlers } from "../../shared/networking/handlers";
import { ProtocolChannel } from "../../shared/networking/protocol";

function createHandlers() {
	return new MessageHandlers<() => void>(new ProtocolChannel({ events: ["chat", "move"] }, "inbound"));
}

describe("MessageHandlers", () => {
	test("finds each event's handler by its wire code", () => {
		const handlers = createHandlers();
		const chat = () => {};
		const move = () => {};

		handlers.add("chat", chat);
		handlers.add("move", move);

		expect(handlers.get(0)).toBe(chat);
		expect(handlers.get(1)).toBe(move);
	});

	test("an event takes one handler: a second throws instead of replacing the first", () => {
		const handlers = createHandlers();

		handlers.add("chat", () => {});

		expect(() => handlers.add("chat", () => {})).toThrow('"chat" already has a handler');
		expect(() => handlers.add("move", () => {})).not.toThrow();
	});

	test("the remover frees the event, and only ever removes its own handler", () => {
		const handlers = createHandlers();
		const remove = handlers.add("chat", () => {});

		remove();

		const next = () => {};

		handlers.add("chat", next);
		remove();

		expect(handlers.get(0)).toBe(next);
	});

	test("an event outside the protocol throws", () => {
		expect(() => createHandlers().add("jump", () => {})).toThrow();
	});
});

describe("ProtocolChannel", () => {
	test("a direction declares up to 256 events, one per byte, the last one included", () => {
		const events = Array.from({ length: 256 }, (_, code) => `event${code}`);
		const channel = new ProtocolChannel({ events }, "inbound");

		expect(channel.name(255)).toBe("event255");
		expect(() => new ProtocolChannel({ events: [...events, "one more"] }, "inbound")).toThrow(RangeError);
	});
});
