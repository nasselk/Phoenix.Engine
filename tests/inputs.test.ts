import { describe, expect, test } from "bun:test";

(globalThis as { HTMLElement?: unknown }).HTMLElement ??= class {};
(globalThis as { KeyboardEvent?: unknown }).KeyboardEvent ??= class {
	public constructor(
		public readonly type: string,
		init: { key: string; code: string },
		public readonly key = init.key,
		public readonly code = init.code,
	) {}
};

const { InputSystem } = await import("../client/src/controls/InputSystem");

type Handlers = { keydown(event: object): void; keyup(event: object): void; blur(): void };

function createInputs() {
	const inputs = new InputSystem({ binds: { jump: ["Space"], forward: ["KeyW", "ArrowUp"], emote: [] } });
	const handlers = (inputs as unknown as { handlers: Handlers }).handlers;
	const key = (code: string, repeat = false) => ({ code, key: code, repeat, target: null });

	return {
		inputs,
		down: (code: string, repeat?: boolean) => handlers.keydown(key(code, repeat)),
		up: (code: string) => handlers.keyup(key(code)),
		blur: () => handlers.blur(),
	};
}

describe("inputs", () => {
	test("an action starts and stops with its key", () => {
		const { inputs, down, up } = createInputs();
		const log: string[] = [];

		inputs.onActionStart("jump", () => log.push("start"));
		inputs.onActionStop("jump", () => log.push("stop"));

		down("Space");
		expect(inputs.isActionRunning("jump")).toBe(true);

		up("Space");
		expect(inputs.isActionRunning("jump")).toBe(false);
		expect(log).toEqual(["start", "stop"]);
	});

	test("a held key's repeats start it once", () => {
		const { inputs, down } = createInputs();
		let starts = 0;

		inputs.onActionStart("jump", () => starts++);

		down("Space");
		down("Space", true);
		down("Space");

		expect(starts).toBe(1);
	});

	test("either of two keys runs the action, until both are up", () => {
		const { inputs, down, up } = createInputs();

		down("KeyW");
		down("ArrowUp");
		up("KeyW");
		expect(inputs.isActionRunning("forward")).toBe(true);

		up("ArrowUp");
		expect(inputs.isActionRunning("forward")).toBe(false);
	});

	test("rebinding while a key is held keeps the count right", () => {
		const { inputs, down, up } = createInputs();

		down("KeyW");
		inputs.unmapActionFromKeys("forward");
		expect(inputs.isActionRunning("forward")).toBe(false);

		inputs.mapActionToKeys("forward", "KeyW");
		expect(inputs.isActionRunning("forward")).toBe(true);

		up("KeyW");
		expect(inputs.isActionRunning("forward")).toBe(false);
	});

	test("an action declared without keys works once bound", () => {
		const { inputs, down } = createInputs();

		inputs.mapActionToKeys("emote", "KeyE");
		down("KeyE");

		expect(inputs.isActionRunning("emote")).toBe(true);
	});

	test("losing focus releases everything", () => {
		const { inputs, down, blur } = createInputs();
		const stopped: string[] = [];

		inputs.onActionStop("forward", () => stopped.push("forward"));

		down("KeyW");
		blur();

		expect(inputs.isActionRunning("forward")).toBe(false);
		expect(inputs.isInputPressed("KeyW")).toBe(false);
		expect(stopped).toEqual(["forward"]);
	});

	test("every press reaches onPressInput, bound or not", () => {
		const { inputs, down } = createInputs();
		const pressed: string[] = [];

		inputs.onPressInput((event) => pressed.push(event.code));

		down("Space");
		down("KeyQ");

		expect(pressed).toEqual(["Space", "KeyQ"]);
	});

	test("an unknown action throws", () => {
		const { inputs } = createInputs();

		expect(() => inputs.mapActionToKeys("nope" as never, "KeyX")).toThrow('Unknown action "nope"');
	});
});
