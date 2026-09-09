export declare enum Phase {
    Input = 0,
    PreUpdate = 100,
    Update = 200,
    PostUpdate = 300,
    Network = 400,
    Render = 500
}
export type UpdateCallback = (deltaTime: number) => void;
export interface UpdateOptions {
    phase?: number;
    priority?: number;
}
