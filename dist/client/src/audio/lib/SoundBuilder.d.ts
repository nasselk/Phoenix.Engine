import type { Howl } from "howler";
import type { AssetCache } from "../../assets/AssetCache";
export type SoundLayer = (context: OfflineAudioContext, output: AudioNode) => void;
export interface PCMSource {
    readonly sampleRate: number;
    readonly numberOfChannels: number;
    readonly length: number;
    getChannelData(channel: number): Float32Array;
}
export declare function encodeWav(source: PCMSource): ArrayBuffer;
export declare class SoundBuilder {
    private readonly cache;
    private readonly loader;
    private readonly sampleRate;
    private layers;
    private end;
    constructor(cache: AssetCache, sampleRate?: number);
    get duration(): number;
    layer(end: number, build: SoundLayer): this;
    tone(type: OscillatorType, notes: readonly number[], step: number, volume?: number, start?: number): this;
    sweep(type: OscillatorType, low: number, high: number, period: number, repeat?: number, volume?: number, start?: number): this;
    noise(duration: number, from?: number, to?: number, volume?: number, start?: number): this;
    render(): Promise<AudioBuffer>;
    save(name?: string): Promise<Howl>;
    download(name: string): Promise<void>;
    clear(): this;
}
