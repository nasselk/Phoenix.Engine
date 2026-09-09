import { EventEmitter } from "../../../shared/utils/EventEmitter";

type InputEvents = {
	init: [];
	pointermove: [event: PointerEvent];
	destroy: [];
};

/** What an action hands its subscribers: the event that started or stopped it. */
export type ActionCallback = (event: KeyboardEvent) => void;

export type InputSystemOptions<Actions extends readonly string[] = []> = {
	/** The action names this system may emit. Declared as a literal array, they are the only names the action API accepts. */
	readonly actions?: Actions;
	/**
	 * Named sets of actions, one live at a time. The stack's top decides what is enabled, so pushing
	 * "chat" is what stops WASD from driving the player while someone is typing:
	 *
	 *   contexts: { gameplay: ["jump", "shoot"], chat: ["send"] }
	 *
	 * The first one declared is the base and cannot be popped. Declaring none leaves every action
	 * live, which is what a game that never needs a menu wants.
	 */
	readonly contexts?: Readonly<Record<string, readonly Actions[number][]>>;
};

export class InputSystem<const Actions extends readonly string[] = []> extends EventEmitter<InputEvents> {
	/**
	 * The physical keys currently held, as `KeyboardEvent.code` — never `key`.
	 *
	 * `key` is what the layout and the modifiers say the keystroke means, so it is the wrong handle
	 * for a binding twice over: WASD lands on the wrong physical keys on AZERTY, and holding a key
	 * across a Shift press turns "a" into "A", whose keyup then matches nothing and leaves the key
	 * stuck down forever. `code` is the position on the keyboard and never changes mid-press.
	 */
	private readonly pressedCodes: Set<string>;
	/** action → its codes, in bind order. The half a rebinding screen reads and writes. */
	private readonly actions: Map<Actions[number], string[]>;
	/** code → the actions it triggers. The half a keydown reads, so dispatch never scans the bindings. */
	private readonly bindings: Map<string, Array<Actions[number]>>;
	/**
	 * action → how many of its codes are held, so `isRunningAction` is a lookup instead of a scan.
	 *
	 * A cached count is only as good as the paths that maintain it: press, release, bind and unbind
	 * are the four that can change it, and blur releases everything rather than letting a keyup that
	 * arrives while the window is unfocused go missing.
	 */
	private readonly held: Map<Actions[number], number>;
	private readonly actionListeners: {
		start: Map<Actions[number], ActionCallback[]>;
		stop: Map<Actions[number], ActionCallback[]>;
	};
	private readonly contexts: Map<string, ReadonlySet<Actions[number]>>;
	/** Context stack; the last entry is live. Empty means no contexts were declared, so nothing is filtered. */
	private readonly stack: string[];
	/**
	 * The handlers as `window` knows them. `removeEventListener` matches on identity, so binding at
	 * registration time would hand it a wrapper that nothing can ever name again — the listeners
	 * would outlive destroy() and keep this system, and everything it closes over, alive.
	 */
	private readonly handlers: {
		keydown: (event: KeyboardEvent) => void;
		keyup: (event: KeyboardEvent) => void;
		pointerdown: (event: PointerEvent) => void;
		pointerup: (event: PointerEvent) => void;
		pointermove: (event: PointerEvent) => void;
		blur: () => void;
	};
	private initialized: boolean;

	public constructor(options?: InputSystemOptions<Actions>) {
		super();

		this.pressedCodes = new Set();
		this.actions = new Map();
		this.bindings = new Map();
		this.held = new Map();
		this.actionListeners = { start: new Map(), stop: new Map() };
		this.contexts = new Map();
		this.stack = [];
		this.initialized = false;
		this.handlers = {
			keydown: this.keyDown.bind(this),
			keyup: this.keyUp.bind(this),
			pointerdown: this.pointerDown.bind(this),
			pointerup: this.pointerUp.bind(this),
			pointermove: this.pointerMove.bind(this),
			blur: this.releaseAll.bind(this),
		};

		for (const action of options?.actions ?? []) {
			this.actions.set(action, []);
		}

		for (const [name, actions] of Object.entries(options?.contexts ?? {})) {
			for (const action of actions) {
				if (!this.actions.has(action)) {
					throw new Error(`Context "${name}" lists action "${action}", which is not one of the declared actions`);
				}
			}

			this.contexts.set(name, new Set(actions));
		}

		// The first declared context is the base, so a system with contexts is never in the state of
		// having none of them live.
		const base = this.contexts.keys().next();

		if (!base.done) {
			this.stack.push(base.value);
		}
	}

	public init(): void {
		if (this.initialized) {
			throw new Error("InputSystem is already initialized");
		}

		window.addEventListener("keydown", this.handlers.keydown);
		window.addEventListener("keyup", this.handlers.keyup);
		window.addEventListener("pointerdown", this.handlers.pointerdown);
		window.addEventListener("pointerup", this.handlers.pointerup);
		window.addEventListener("pointermove", this.handlers.pointermove);
		// Alt-tabbing while a key is held means its keyup is delivered to someone else, or nobody.
		window.addEventListener("blur", this.handlers.blur);

		this.initialized = true;

		this.emit("init");
	}

	// --- Bindings -------------------------------------------------------------------------------

	/**
	 * Binds a physical key to an action. Binding is live: a key added or removed now takes effect on
	 * the next press, and every existing subscriber follows it, because callbacks are held against
	 * the action rather than against whatever key it happened to be bound to when they subscribed.
	 *
	 * @param action The action to bind to.
	 * @param code A `KeyboardEvent.code` — "Space", "KeyW", "ArrowUp" — or "Pointer0" for a mouse button.
	 *
	 * @returns This InputSystem instance for chaining.
	 */
	public mapKeyToAction(action: Actions[number], code: string): this {
		const codes = this.actions.get(action);

		if (codes === undefined) {
			throw new Error(`Unknown action "${action}". Declare it in the InputSystem's actions option`);
		}

		// Binding the same key twice would fire every callback twice and leave `held` permanently above zero.
		if (codes.includes(code)) {
			return this;
		}

		codes.push(code);

		const actions = this.bindings.get(code);

		if (actions === undefined) {
			this.bindings.set(code, [action]);
		} else {
			actions.push(action);
		}

		// Bound while already held: count it now, or `held` stays one press behind until it is released.
		if (this.pressedCodes.has(code)) {
			this.held.set(action, (this.held.get(action) ?? 0) + 1);
		}

		return this;
	}

	/**
	 * Removes one key from an action, leaving its other keys and all of its subscribers in place.
	 *
	 * @returns True if the key was bound to that action.
	 */
	public unmapKeyFromAction(action: Actions[number], code: string): boolean {
		const codes = this.actions.get(action);
		const index = codes?.indexOf(code) ?? -1;

		if (codes === undefined || index === -1) {
			return false;
		}

		codes.splice(index, 1);

		const actions = this.bindings.get(code);

		if (actions !== undefined) {
			const at = actions.indexOf(action);

			if (at !== -1) {
				actions.splice(at, 1);
			}

			if (actions.length === 0) {
				this.bindings.delete(code);
			}
		}

		// Unbound mid-press: the release that would have decremented it will never look here again.
		if (this.pressedCodes.has(code)) {
			this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));
		}

		return true;
	}

	/** The keys currently bound to an action, in bind order. What a keybind screen renders and saves. */
	public keysForAction(action: Actions[number]): readonly string[] {
		return this.actions.get(action) ?? [];
	}

	/**
	 * Runs `cb` when any key bound to the action goes down, while the action is enabled.
	 *
	 * @returns Unsubscribe function, mirroring EventEmitter.on.
	 */
	public onActionStart(action: Actions[number], cb: ActionCallback): () => void {
		return this.subscribe(this.actionListeners.start, action, cb);
	}

	/**
	 * Runs `cb` when a held key bound to the action goes up, while the action is enabled. Also runs
	 * when the window loses focus with the key still down.
	 *
	 * @returns Unsubscribe function, mirroring EventEmitter.on.
	 */
	public onActionStop(action: Actions[number], cb: ActionCallback): () => void {
		return this.subscribe(this.actionListeners.stop, action, cb);
	}

	private subscribe(into: Map<Actions[number], ActionCallback[]>, action: Actions[number], cb: ActionCallback): () => void {
		if (!this.actions.has(action)) {
			throw new Error(`Unknown action "${action}". Declare it in the InputSystem's actions option`);
		}

		const callbacks = into.get(action);

		if (callbacks === undefined) {
			into.set(action, [cb]);
		} else {
			callbacks.push(cb);
		}

		return () => {
			const current = into.get(action);
			const index = current?.indexOf(cb) ?? -1;

			if (current !== undefined && index !== -1) {
				current.splice(index, 1);
			}
		};
	}

	/**
	 * Whether any key bound to the action is currently held — a lookup, not a scan over its keys.
	 *
	 * A disabled action reads as inactive even while its key is physically down, so a system polling
	 * this never has to ask which context is live. The count itself stays physical, so popping back
	 * to a context with the key still held reports it as active again.
	 */
	public isRunningAction(action: Actions[number]): boolean {
		return this.isActionEnabled(action) && (this.held.get(action) ?? 0) > 0;
	}

	/** Whether a physical key is down, by `KeyboardEvent.code`. */
	public isKeyPressed(code: string): boolean {
		return this.pressedCodes.has(code);
	}

	/**
	 * Checks if a key event corresponds to a printable character. Uses `key`, not `code`, because
	 * this one asks what the keystroke types rather than which key was struck.
	 *
	 * @param event The keyboard event to check.
	 *
	 * @returns True if the key is printable, false otherwise.
	 */
	public isPrintableKey(event: KeyboardEvent): boolean {
		if (event.metaKey || (event.altKey && event.key !== "AltGraph")) {
			return false;
		}

		return event.key.length === 1 || ["Enter", "Tab", "Backspace"].includes(event.key);
	}

	// --- Contexts -------------------------------------------------------------------------------

	/** The live context, or undefined when none were declared and everything is enabled. */
	public get context(): string | undefined {
		return this.stack[this.stack.length - 1];
	}

	/** Whether the live context enables this action. Always true when no contexts were declared. */
	public isActionEnabled(action: Actions[number]): boolean {
		const context = this.context;

		return context === undefined || (this.contexts.get(context)?.has(action) ?? false);
	}

	/** Makes a context live, keeping what is under it. Pair with popContext to restore. */
	public pushContext(name: string): this {
		if (!this.contexts.has(name)) {
			throw new Error(`Unknown context "${name}". Declare it in the InputSystem's contexts option`);
		}

		this.stack.push(name);

		return this;
	}

	/**
	 * Returns to the context underneath. The base context is never popped, so the system cannot end
	 * up with nothing enabled.
	 *
	 * @returns The context left, or undefined if the base was already live.
	 */
	public popContext(): string | undefined {
		return this.stack.length > 1 ? this.stack.pop() : undefined;
	}

	/** Replaces the whole stack, making `name` both the live context and the base. */
	public setContext(name: string): this {
		if (!this.contexts.has(name)) {
			throw new Error(`Unknown context "${name}". Declare it in the InputSystem's contexts option`);
		}

		this.stack.length = 0;
		this.stack.push(name);

		return this;
	}

	// --- Dispatch -------------------------------------------------------------------------------

	private keyDown(event: KeyboardEvent): void {
		if (!event.repeat) {
			this.press(event.code, event);
		}
	}

	private keyUp(event: KeyboardEvent): void {
		this.release(event.code, event);
	}

	private press(code: string, event: KeyboardEvent): void {
		// A key already down cannot go down again: OS-level repeats and refocus replays would
		// otherwise double-count it and fire start twice for one press.
		if (this.pressedCodes.has(code)) {
			return;
		}

		this.pressedCodes.add(code);

		for (const action of this.bindings.get(code) ?? []) {
			this.held.set(action, (this.held.get(action) ?? 0) + 1);

			this.dispatch(this.actionListeners.start, action, event);
		}
	}

	private release(code: string, event: KeyboardEvent): void {
		if (!this.pressedCodes.delete(code)) {
			return;
		}

		for (const action of this.bindings.get(code) ?? []) {
			this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));

			this.dispatch(this.actionListeners.stop, action, event);
		}
	}

	private dispatch(from: Map<Actions[number], ActionCallback[]>, action: Actions[number], event: KeyboardEvent): void {
		if (!this.isActionEnabled(action)) {
			return;
		}

		const callbacks = from.get(action);

		if (callbacks !== undefined && callbacks.length > 0) {
			// Copied so a callback may unsubscribe itself, or another, without the loop skipping one.
			for (const cb of [...callbacks]) {
				cb(event);
			}
		}
	}

	/**
	 * Releases every held key, firing each action's stop.
	 *
	 * Bound to blur: a key held while the window loses focus has its keyup delivered somewhere else,
	 * so without this the key stays down forever and the player keeps walking into a wall.
	 */
	private releaseAll(): void {
		for (const code of [...this.pressedCodes]) {
			this.release(code, this.syntheticEvent(code, "keyup"));
		}
	}

	private pointerDown(event: PointerEvent): void {
		const code = `Pointer${event.button}`;

		this.press(code, this.syntheticEvent(code, "keydown"));
	}

	private pointerUp(event: PointerEvent): void {
		const code = `Pointer${event.button}`;

		this.release(code, this.syntheticEvent(code, "keyup"));
	}

	private pointerMove(event: PointerEvent): void {
		this.emit("pointermove", event);
	}

	/**
	 * A mouse button as a keyboard event, so one binding table covers both.
	 *
	 * Built and routed here rather than dispatched at `window`: a fake keydown on the document is
	 * visible to every other keydown listener on the page, text fields and UI frameworks included.
	 */
	private syntheticEvent(code: string, type: "keydown" | "keyup"): KeyboardEvent {
		return new KeyboardEvent(type, { key: code, code });
	}

	public destroy(): void {
		if (!this.initialized) {
			return;
		}

		window.removeEventListener("keydown", this.handlers.keydown);
		window.removeEventListener("keyup", this.handlers.keyup);
		window.removeEventListener("pointerdown", this.handlers.pointerdown);
		window.removeEventListener("pointerup", this.handlers.pointerup);
		window.removeEventListener("pointermove", this.handlers.pointermove);
		window.removeEventListener("blur", this.handlers.blur);

		// The action callbacks are game code holding game state; pressed keys and held counts are
		// stale the moment the keyboard is no longer watched. The bindings and contexts are
		// configuration, so they survive — a destroyed system can be init()ed again as it was.
		this.actionListeners.start.clear();
		this.actionListeners.stop.clear();
		this.pressedCodes.clear();
		this.held.clear();

		this.initialized = false;

		// Emit before dropping subscribers, or nobody is left to hear it.
		this.emit("destroy");

		this.removeAllListeners();
	}
}
