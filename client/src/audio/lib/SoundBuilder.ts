import type { Howl } from "howler";
import type { AssetCache } from "../../assets/AssetCache";
import { SoundLoader } from "../../assets/loaders/sound";

/** Adds nodes to the sound being built, all ending in `output`, timed in seconds from its start. */
export type SoundLayer = (context: OfflineAudioContext, output: AudioNode) => void;

/** The samples a WAV file holds, as an `AudioBuffer` has them. */
export interface PCMSource {
	readonly sampleRate: number;
	readonly numberOfChannels: number;
	readonly length: number;
	getChannelData(channel: number): Float32Array;
}

/** A 16-bit PCM WAV file of these samples, channels interleaved. */
export function encodeWav(source: PCMSource): ArrayBuffer {
	const channels = source.numberOfChannels;
	const dataSize = source.length * channels * 2;
	const view = new DataView(new ArrayBuffer(44 + dataSize));

	const text = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i++) {
			view.setUint8(offset + i, value.charCodeAt(i));
		}
	};

	text(0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	text(8, "WAVE");
	text(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channels, true);
	view.setUint32(24, source.sampleRate, true);
	view.setUint32(28, source.sampleRate * channels * 2, true);
	view.setUint16(32, channels * 2, true);
	view.setUint16(34, 16, true);
	text(36, "data");
	view.setUint32(40, dataSize, true);

	const data: Float32Array[] = [];

	for (let channel = 0; channel < channels; channel++) {
		data.push(source.getChannelData(channel));
	}

	let offset = 44;

	for (let i = 0; i < source.length; i++) {
		for (let channel = 0; channel < channels; channel++) {
			const sample = Math.max(-1, Math.min(1, data[channel]![i]!));

			view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
			offset += 2;
		}
	}

	return view.buffer;
}

/**
 * Synthesises sounds in code — oscillators, sweeps, filtered noise — so a game has feedback before it
 * has recorded audio. Layers are added one after the other, then `save` renders them once into a
 * sound that plays like a loaded one, under the master volume and mute:
 *
 *   await engine.audio.soundBuilder.tone("triangle", [520, 780, 1170], 0.07).save("pickup");
 *   engine.audio.play("pickup");
 */
export class SoundBuilder {
	private readonly cache: AssetCache;
	private readonly loader: SoundLoader;
	private readonly sampleRate: number;
	private layers: SoundLayer[] = [];
	private end = 0;

	public constructor(cache: AssetCache, sampleRate: number = 44100) {
		this.cache = cache;
		this.loader = new SoundLoader();
		this.sampleRate = sampleRate;
	}

	/** The length of the sound so far, in seconds. */
	public get duration(): number {
		return this.end;
	}

	/** Any nodes, for what the other layers cannot make. The sound lasts at least until `end`. */
	public layer(end: number, build: SoundLayer): this {
		this.layers.push(build);
		this.end = Math.max(this.end, end);

		return this;
	}

	/** Notes one after the other, each `step` seconds long, in one quick attack and a decay. */
	public tone(type: OscillatorType, notes: readonly number[], step: number, volume: number = 0.2, start: number = 0): this {
		const end = start + notes.length * step + 0.12;

		return this.layer(end, (context, output) => {
			const oscillator = context.createOscillator();
			const gain = context.createGain();

			oscillator.type = type;

			for (let i = 0; i < notes.length; i++) {
				oscillator.frequency.setValueAtTime(notes[i]!, start + i * step);
			}

			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.0001, end);

			oscillator.connect(gain).connect(output);
			oscillator.start(start);
			oscillator.stop(end);
		});
	}

	/** A pitch rising from `low` to `high` and back, `repeat` times, each `period` seconds long: a siren. */
	public sweep(type: OscillatorType, low: number, high: number, period: number, repeat: number = 1, volume: number = 0.12, start: number = 0): this {
		const length = period * repeat;
		const fade = Math.min(0.15, length / 4);
		const end = start + length + 0.05;

		return this.layer(end, (context, output) => {
			const oscillator = context.createOscillator();
			const gain = context.createGain();

			oscillator.type = type;

			for (let i = 0; i < repeat; i++) {
				const at = start + i * period;

				oscillator.frequency.setValueAtTime(low, at);
				oscillator.frequency.linearRampToValueAtTime(high, at + period / 2);
				oscillator.frequency.linearRampToValueAtTime(low, at + period);
			}

			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(volume, start + 0.05);
			gain.gain.setValueAtTime(volume, start + length - fade);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

			oscillator.connect(gain).connect(output);
			oscillator.start(start);
			oscillator.stop(end);
		});
	}

	/** White noise through a low-pass filter closing from `from` to `to` Hz, fading out: water, wind, impacts. */
	public noise(duration: number, from: number = 1800, to: number = 200, volume: number = 0.3, start: number = 0): this {
		const end = start + duration;

		return this.layer(end, (context, output) => {
			const buffer = context.createBuffer(1, Math.ceil(duration * context.sampleRate), context.sampleRate);
			const data = buffer.getChannelData(0);

			for (let i = 0; i < data.length; i++) {
				data[i] = Math.random() * 2 - 1;
			}

			const source = context.createBufferSource();
			const filter = context.createBiquadFilter();
			const gain = context.createGain();

			source.buffer = buffer;
			filter.type = "lowpass";
			filter.frequency.setValueAtTime(from, start);
			filter.frequency.exponentialRampToValueAtTime(to, end);

			gain.gain.setValueAtTime(volume, start);
			gain.gain.exponentialRampToValueAtTime(0.0001, end);

			source.connect(filter).connect(gain).connect(output);
			source.start(start);
			source.stop(end);
		});
	}

	/** Render the layers into samples, and start a new sound. */
	public async render(): Promise<AudioBuffer> {
		const layers = this.layers;
		const length = Math.max(1, Math.ceil(this.end * this.sampleRate));

		this.clear();

		const context = new OfflineAudioContext(1, length, this.sampleRate);

		for (const layer of layers) {
			layer(context, context.destination);
		}

		return context.startRendering();
	}

	/** Render the layers into a sound, kept in the cache as a `sound` under `name` when there is one. */
	public async save(name?: string): Promise<Howl> {
		const blob = new Blob([encodeWav(await this.render())], { type: "audio/wav" });
		const howl = await this.loader.load({ src: await dataURL(blob), format: ["wav"] });

		if (name) {
			this.cache.set("sound", name, howl);
		}

		return howl;
	}

	/** Render the layers and download them as a WAV file, to keep a sound that came out right. */
	public async download(name: string): Promise<void> {
		const blob = new Blob([encodeWav(await this.render())], { type: "audio/wav" });

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${name}.wav`;
		a.click();

		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	/** Drop the layers added so far. */
	public clear(): this {
		this.layers = [];
		this.end = 0;

		return this;
	}
}

function dataURL(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}
