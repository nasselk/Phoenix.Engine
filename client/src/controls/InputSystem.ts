/** What an action hands its subscribers: the event that started or stopped it. */
export type ActionCallback = (event: KeyboardEvent) => void;

export type InputSystemOptions<Action extends string = never> = {
	/**
	 * Every action and the keys it starts bound to, as `KeyboardEvent.code`s. Its keys are the only
	 * action names the API accepts, so an action with no default key is still listed: `{ jump: ["Space"], emote: [] }`.
	 */
	readonly binds?: Readonly<Record<Action, readonly string[]>>;
};

function isEditable(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
}

export class InputSystem<const Action extends string = never> {
	/**
	 * The physical keys currently held, as `KeyboardEvent.code` — never `key`.
	 *
	 * `key` is what the layout and the modifiers say the keystroke means, so it is the wrong handle
	 * for a binding twice over: WASD lands on the wrong physical keys on AZERTY, and holding a key
	 * across a Shift press turns "a" into "A", whose keyup then matches nothing and leaves the key
	 * stuck down forever. `code` is the position on the keyboard and never changes mid-press.
	 */
	private readonly pressedCodes = new Set<string>();
	/** action → its codes, in bind order. */
	private readonly actions = new Map<Action, string[]>();
	/** code → the actions it triggers, so dispatch never scans the bindings. */
	private readonly bindings = new Map<string, Action[]>();
	/** action → how many of its codes are held, so `isActionRunning` is a lookup instead of a scan. */
	private readonly held = new Map<Action, number>();
	private readonly listeners = {
		start: new Map<Action, ActionCallback[]>(),
		stop: new Map<Action, ActionCallback[]>(),
		press: [] as ((event: KeyboardEvent) => void)[],
	};
	/**
	 * The handlers as `window` knows them. `removeEventListener` matches on identity, so binding at
	 * registration time would hand it a wrapper that nothing can ever name again.
	 */
	private readonly handlers = {
		keydown: (event: KeyboardEvent) => this.keyDown(event),
		keyup: (event: KeyboardEvent) => this.release(event.code, event),
		pointerdown: (event: PointerEvent) => this.press(`Pointer${event.button}`, this.syntheticEvent(`Pointer${event.button}`, "keydown")),
		pointerup: (event: PointerEvent) => this.release(`Pointer${event.button}`, this.syntheticEvent(`Pointer${event.button}`, "keyup")),
		blur: () => this.releaseAll(),
	};
	private initialized = false;

	public constructor(options?: InputSystemOptions<Action>) {
		const binds = options?.binds ?? ({} as Readonly<Record<Action, readonly string[]>>);

		for (const action of Object.keys(binds) as Action[]) {
			this.actions.set(action, []);
			this.mapActionToKeys(action, ...binds[action]);
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
		window.addEventListener("blur", this.handlers.blur);

		this.initialized = true;
	}

	/**
	 * Binds physical keys to an action, after the ones it already has. Live: every existing subscriber
	 * follows the new keys, because callbacks are held against the action, not its keys.
	 *
	 * @param codes `KeyboardEvent.code`s — "Space", "KeyW", "ArrowUp" — or "Pointer0" for a mouse button.
	 */
	public mapActionToKeys(action: Action, ...codes: readonly string[]): this {
		const bound = this.codesOf(action);

		for (const code of codes) {
			// Binding the same key twice would fire every callback twice and leave `held` permanently above zero.
			if (bound.includes(code)) {
				continue;
			}

			bound.push(code);

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
		}

		return this;
	}

	/** Removes those keys from an action, or every key it has when none are given. Its subscribers stay. */
	public unmapActionFromKeys(action: Action, ...codes: readonly string[]): this {
		const bound = this.codesOf(action);

		for (const code of codes.length === 0 ? [...bound] : codes) {
			const index = bound.indexOf(code);

			if (index === -1) {
				continue;
			}

			bound.splice(index, 1);

			const actions = this.bindings.get(code)!;

			actions.splice(actions.indexOf(action), 1);

			if (actions.length === 0) {
				this.bindings.delete(code);
			}

			// Unbound mid-press: the release that would have decremented it will never look here again.
			if (this.pressedCodes.has(code)) {
				this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));
			}
		}

		return this;
	}

	/** Runs `cb` when any key bound to the action goes down. @returns Unsubscribe function. */
	public onActionStart(action: Action, cb: ActionCallback): () => void {
		return this.subscribe(this.listeners.start, action, cb);
	}

	/** Runs `cb` when a held key bound to the action goes up, or the window loses focus with it down. @returns Unsubscribe function. */
	public onActionStop(action: Action, cb: ActionCallback): () => void {
		return this.subscribe(this.listeners.stop, action, cb);
	}

	/** Runs `cb` on every key or mouse button press, bound or not, outside text fields. @returns Unsubscribe function. */
	public onPressInput(cb: (event: KeyboardEvent) => void): () => void {
		this.listeners.press.push(cb);

		return () => {
			const index = this.listeners.press.indexOf(cb);

			if (index !== -1) {
				this.listeners.press.splice(index, 1);
			}
		};
	}

	/** Whether any key bound to the action is held. */
	public isActionRunning(action: Action): boolean {
		return (this.held.get(action) ?? 0) > 0;
	}

	/** Whether a physical key or mouse button is down, by `KeyboardEvent.code` or "Pointer0". */
	public isInputPressed(code: string): boolean {
		return this.pressedCodes.has(code);
	}

	/** Whether a key event types a character. Uses `key`, not `code`: it asks what was typed, not which key was struck. */
	public isPrintableKey(event: KeyboardEvent): boolean {
		if (event.metaKey || (event.altKey && event.key !== "AltGraph")) {
			return false;
		}

		return event.key.length === 1 || ["Enter", "Tab", "Backspace"].includes(event.key);
	}

	private codesOf(action: Action): string[] {
		const codes = this.actions.get(action);

		if (codes === undefined) {
			throw new Error(`Unknown action "${action}". Declare it in the InputSystem's binds option`);
		}

		return codes;
	}

	private subscribe(into: Map<Action, ActionCallback[]>, action: Action, cb: ActionCallback): () => void {
		this.codesOf(action);

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

	private keyDown(event: KeyboardEvent): void {
		// Typing into a text field is not playing: the keys go to the field, not to the actions. The
		// keyup still goes through, so a key held before the field took focus is released.
		if (!event.repeat && !isEditable(event.target)) {
			this.press(event.code, event);
		}
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

			this.dispatch(this.listeners.start.get(action), event);
		}

		this.dispatch(this.listeners.press, event);
	}

	private release(code: string, event: KeyboardEvent): void {
		if (!this.pressedCodes.delete(code)) {
			return;
		}

		for (const action of this.bindings.get(code) ?? []) {
			this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));

			this.dispatch(this.listeners.stop.get(action), event);
		}
	}

	private dispatch(callbacks: readonly ((event: KeyboardEvent) => void)[] | undefined, event: KeyboardEvent): void {
		if (callbacks !== undefined && callbacks.length > 0) {
			// Copied so a callback may unsubscribe itself, or another, without the loop skipping one.
			for (const cb of [...callbacks]) {
				cb(event);
			}
		}
	}

	/** Releases every held key, firing each action's stop: a key held while the window loses focus never gets its keyup. */
	private releaseAll(): void {
		for (const code of [...this.pressedCodes]) {
			this.release(code, this.syntheticEvent(code, "keyup"));
		}
	}

	/**
	 * A mouse button as a keyboard event, so one binding table covers both. Routed here rather than
	 * dispatched at `window`, where every other keydown listener on the page would see it.
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
		window.removeEventListener("blur", this.handlers.blur);

		// Callbacks are game code and pressed keys are stale once the keyboard is no longer watched.
		// The bindings are configuration, so a destroyed system can be init()ed again as it was.
		this.listeners.start.clear();
		this.listeners.stop.clear();
		this.listeners.press.length = 0;
		this.pressedCodes.clear();
		this.held.clear();

		this.initialized = false;
	}
}
