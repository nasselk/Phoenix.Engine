import { EventEmitter } from "../../../shared/utils/EventEmitter";
import type { AssetManager } from "../assets/AssetManager";
type AudioSystemEvents = {
    init: [];
    play: [id: string, soundId: number];
    pause: [id: string, soundId: number];
    stop: [id: string, soundId: number];
    mute: [isMuted: boolean];
    volume: [level: number];
    destroy: [];
};
export declare const enum AudioSystemState {
    NULL = 0,
    INITIALIZING = 1,
    INITIALIZED = 2,
    DESTROYED = 3
}
export interface AudioOptions {
    globalVolume: number;
    muteInitial: boolean;
}
export declare class AudioSystem extends EventEmitter<AudioSystemEvents> {
    private readonly assets;
    initialized: AudioSystemState;
    constructor(assets: AssetManager);
    init(settings?: Partial<AudioOptions>): Promise<void>;
    play(id: string, spriteId?: string): number | undefined;
    pause(id?: string, playbackId?: number): void;
    stop(id?: string, playbackId?: number): void;
    destroy(): Promise<void>;
    set volume(value: number);
    get volume(): number;
    set muted(value: boolean);
    get muted(): boolean;
    private assertInitialized;
}
export {};
