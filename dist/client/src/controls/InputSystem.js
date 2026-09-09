import { EventEmitter } from "../../../shared/utils/EventEmitter";
export class InputSystem extends EventEmitter {
    constructor(options) {
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
        const base = this.contexts.keys().next();
        if (!base.done) {
            this.stack.push(base.value);
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
        window.addEventListener("pointermove", this.handlers.pointermove);
        window.addEventListener("blur", this.handlers.blur);
        this.initialized = true;
        this.emit("init");
    }
    mapKeyToAction(action, code) {
        const codes = this.actions.get(action);
        if (codes === undefined) {
            throw new Error(`Unknown action "${action}". Declare it in the InputSystem's actions option`);
        }
        if (codes.includes(code)) {
            return this;
        }
        codes.push(code);
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
        return this;
    }
    unmapKeyFromAction(action, code) {
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
        if (this.pressedCodes.has(code)) {
            this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));
        }
        return true;
    }
    keysForAction(action) {
        return this.actions.get(action) ?? [];
    }
    onActionStart(action, cb) {
        return this.subscribe(this.actionListeners.start, action, cb);
    }
    onActionStop(action, cb) {
        return this.subscribe(this.actionListeners.stop, action, cb);
    }
    subscribe(into, action, cb) {
        if (!this.actions.has(action)) {
            throw new Error(`Unknown action "${action}". Declare it in the InputSystem's actions option`);
        }
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
    isRunningAction(action) {
        return this.isActionEnabled(action) && (this.held.get(action) ?? 0) > 0;
    }
    isKeyPressed(code) {
        return this.pressedCodes.has(code);
    }
    isPrintableKey(event) {
        if (event.metaKey || (event.altKey && event.key !== "AltGraph")) {
            return false;
        }
        return event.key.length === 1 || ["Enter", "Tab", "Backspace"].includes(event.key);
    }
    get context() {
        return this.stack[this.stack.length - 1];
    }
    isActionEnabled(action) {
        const context = this.context;
        return context === undefined || (this.contexts.get(context)?.has(action) ?? false);
    }
    pushContext(name) {
        if (!this.contexts.has(name)) {
            throw new Error(`Unknown context "${name}". Declare it in the InputSystem's contexts option`);
        }
        this.stack.push(name);
        return this;
    }
    popContext() {
        return this.stack.length > 1 ? this.stack.pop() : undefined;
    }
    setContext(name) {
        if (!this.contexts.has(name)) {
            throw new Error(`Unknown context "${name}". Declare it in the InputSystem's contexts option`);
        }
        this.stack.length = 0;
        this.stack.push(name);
        return this;
    }
    keyDown(event) {
        if (!event.repeat) {
            this.press(event.code, event);
        }
    }
    keyUp(event) {
        this.release(event.code, event);
    }
    press(code, event) {
        if (this.pressedCodes.has(code)) {
            return;
        }
        this.pressedCodes.add(code);
        for (const action of this.bindings.get(code) ?? []) {
            this.held.set(action, (this.held.get(action) ?? 0) + 1);
            this.dispatch(this.actionListeners.start, action, event);
        }
    }
    release(code, event) {
        if (!this.pressedCodes.delete(code)) {
            return;
        }
        for (const action of this.bindings.get(code) ?? []) {
            this.held.set(action, Math.max((this.held.get(action) ?? 0) - 1, 0));
            this.dispatch(this.actionListeners.stop, action, event);
        }
    }
    dispatch(from, action, event) {
        if (!this.isActionEnabled(action)) {
            return;
        }
        const callbacks = from.get(action);
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
    pointerDown(event) {
        const code = `Pointer${event.button}`;
        this.press(code, this.syntheticEvent(code, "keydown"));
    }
    pointerUp(event) {
        const code = `Pointer${event.button}`;
        this.release(code, this.syntheticEvent(code, "keyup"));
    }
    pointerMove(event) {
        this.emit("pointermove", event);
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
        window.removeEventListener("pointermove", this.handlers.pointermove);
        window.removeEventListener("blur", this.handlers.blur);
        this.actionListeners.start.clear();
        this.actionListeners.stop.clear();
        this.pressedCodes.clear();
        this.held.clear();
        this.initialized = false;
        this.emit("destroy");
        this.removeAllListeners();
    }
}
