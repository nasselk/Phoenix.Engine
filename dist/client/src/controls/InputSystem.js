function isEditable(target) {
    return target instanceof HTMLElement && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
}
export class InputSystem {
    constructor(options) {
        this.pressedCodes = new Set();
        this.actions = new Map();
        this.bindings = new Map();
        this.held = new Map();
        this.listeners = {
            start: new Map(),
            stop: new Map(),
            press: [],
        };
        this.handlers = {
            keydown: (event) => this.keyDown(event),
            keyup: (event) => this.release(event.code, event),
            pointerdown: (event) => this.press(`Pointer${event.button}`, this.syntheticEvent(`Pointer${event.button}`, "keydown")),
            pointerup: (event) => this.release(`Pointer${event.button}`, this.syntheticEvent(`Pointer${event.button}`, "keyup")),
            blur: () => this.releaseAll(),
        };
        this.initialized = false;
        const binds = options?.binds ?? {};
        for (const action of Object.keys(binds)) {
            this.actions.set(action, []);
            this.mapActionToKeys(action, ...binds[action]);
        }
    }
    init() {
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
    mapActionToKeys(action, ...codes) {
        const bound = this.codesOf(action);
        for (const code of codes) {
            if (bound.includes(code)) {
                continue;
            }
            bound.push(code);
            const actions = this.bindings.get(code);
            if (actions === undefined) {
                this.bindings.set(code, [action]);
            }
            else {
                actions.push(action);
            }
            if (this.pressedCodes.has(code)) {
                this.held.set(action, (this.held.get(action) ?? 0) + 1);
            }
        }
        return this;
    }
    unmapActionFromKeys(action, ...codes) {
        const bound = this.codesOf(action);
        for (const code of codes.length === 0 ? [...bound] : codes) {
            const index = bound.indexOf(code);
            if (index === -1) {
                continue;
            }
            bound.splice(index, 1);
            const actions = this.bindings.get(code);
            actions.splice(actions.indexOf(action), 1);
            if (actions.length === 0) {
                this.bindings.delete(code);
            }
            if (this.pressedCodes.has(code)) {
                this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));
            }
        }
        return this;
    }
    onActionStart(action, cb) {
        return this.subscribe(this.listeners.start, action, cb);
    }
    onActionStop(action, cb) {
        return this.subscribe(this.listeners.stop, action, cb);
    }
    onPressInput(cb) {
        this.listeners.press.push(cb);
        return () => {
            const index = this.listeners.press.indexOf(cb);
            if (index !== -1) {
                this.listeners.press.splice(index, 1);
            }
        };
    }
    isActionRunning(action) {
        return (this.held.get(action) ?? 0) > 0;
    }
    isInputPressed(code) {
        return this.pressedCodes.has(code);
    }
    isPrintableKey(event) {
        if (event.metaKey || (event.altKey && event.key !== "AltGraph")) {
            return false;
        }
        return event.key.length === 1 || ["Enter", "Tab", "Backspace"].includes(event.key);
    }
    codesOf(action) {
        const codes = this.actions.get(action);
        if (codes === undefined) {
            throw new Error(`Unknown action "${action}". Declare it in the InputSystem's binds option`);
        }
        return codes;
    }
    subscribe(into, action, cb) {
        this.codesOf(action);
        const callbacks = into.get(action);
        if (callbacks === undefined) {
            into.set(action, [cb]);
        }
        else {
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
    keyDown(event) {
        if (!event.repeat && !isEditable(event.target)) {
            this.press(event.code, event);
        }
    }
    press(code, event) {
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
    release(code, event) {
        if (!this.pressedCodes.delete(code)) {
            return;
        }
        for (const action of this.bindings.get(code) ?? []) {
            this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));
            this.dispatch(this.listeners.stop.get(action), event);
        }
    }
    dispatch(callbacks, event) {
        if (callbacks !== undefined && callbacks.length > 0) {
            for (const cb of [...callbacks]) {
                cb(event);
            }
        }
    }
    releaseAll() {
        for (const code of [...this.pressedCodes]) {
            this.release(code, this.syntheticEvent(code, "keyup"));
        }
    }
    syntheticEvent(code, type) {
        return new KeyboardEvent(type, { key: code, code });
    }
    destroy() {
        if (!this.initialized) {
            return;
        }
        window.removeEventListener("keydown", this.handlers.keydown);
        window.removeEventListener("keyup", this.handlers.keyup);
        window.removeEventListener("pointerdown", this.handlers.pointerdown);
        window.removeEventListener("pointerup", this.handlers.pointerup);
        window.removeEventListener("blur", this.handlers.blur);
        this.listeners.start.clear();
        this.listeners.stop.clear();
        this.listeners.press.length = 0;
        this.pressedCodes.clear();
        this.held.clear();
        this.initialized = false;
    }
}
