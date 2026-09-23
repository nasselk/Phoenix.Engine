export type ActionCallback = (event: KeyboardEvent) => void;
export type InputSystemOptions<Action extends string = never> = {
    readonly binds?: Readonly<Record<Action, readonly string[]>>;
};
export declare class InputSystem<const Action extends string = never> {
    private readonly pressedCodes;
    private readonly actions;
    private readonly bindings;
    private readonly held;
    private readonly listeners;
    private readonly handlers;
    private initialized;
    constructor(options?: InputSystemOptions<Action>);
    init(): void;
    mapActionToKeys(action: Action, ...codes: readonly string[]): this;
    unmapActionFromKeys(action: Action, ...codes: readonly string[]): this;
    onActionStart(action: Action, cb: ActionCallback): () => void;
    onActionStop(action: Action, cb: ActionCallback): () => void;
    onPressInput(cb: (event: KeyboardEvent) => void): () => void;
    isActionRunning(action: Action): boolean;
    isInputPressed(code: string): boolean;
    isPrintableKey(event: KeyboardEvent): boolean;
    private codesOf;
    private subscribe;
    private keyDown;
    private press;
    private release;
    private dispatch;
    private releaseAll;
    private syntheticEvent;
    destroy(): void;
}
