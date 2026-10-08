export type Sound = "pickup" | "buy" | "siren" | "splash" | "rebirth" | "error" | "place";

/**
 * Little synthesised sounds, so a game has feedback before it has recorded audio. Everything is made
 * with oscillators and noise on the fly; nothing is downloaded.
 */
export class Sfx {
	private context?: AudioContext;
	private master?: GainNode;
	private noise?: AudioBuffer;
	private level = 1;
	private silent = false;

	public set volume(volume: number) {
		this.level = volume;
		this.apply();
	}

	public set muted(muted: boolean) {
		this.silent = muted;
		this.apply();
	}

	public play(sound: Sound): void {
		const context = this.ready();

		if (context === undefined) {
			return;
		}

		const now = context.currentTime;

		switch (sound) {
			case "pickup":
				this.tone("triangle", [520, 780, 1170], now, 0.07, 0.25);
				break;
			case "place":
				this.tone("sine", [660, 990], now, 0.08, 0.2);
				break;
			case "buy":
				this.tone("triangle", [523, 659, 784, 1047], now, 0.06, 0.2);
				break;
			case "rebirth":
				this.tone("sawtooth", [262, 330, 392, 523, 659, 784, 1047], now, 0.09, 0.14);
				break;
			case "error":
				this.tone("square", [220, 180], now, 0.1, 0.1);
				break;
			case "siren":
				this.sweep(now);
				break;
			case "splash":
				this.hiss(now, 0.9, 1800);
				break;
		}
	}

	private ready(): AudioContext | undefined {
		if (this.context === undefined) {
			try {
				this.context = new AudioContext();
				this.master = this.context.createGain();
				this.master.connect(this.context.destination);
				this.apply();
			} catch {
				return undefined;
			}
		}

		if (this.context.state === "suspended") {
			void this.context.resume();
		}

		return this.context;
	}

	private apply(): void {
		if (this.master !== undefined) {
			this.master.gain.value = this.silent ? 0 : this.level * 0.35;
		}
	}

	/** Notes one after the other, each `step` seconds long. */
	private tone(type: OscillatorType, notes: readonly number[], start: number, step: number, volume: number): void {
		const context = this.context!;
		const oscillator = context.createOscillator();
		const gain = context.createGain();

		oscillator.type = type;

		notes.forEach((frequency, i) => oscillator.frequency.setValueAtTime(frequency, start + i * step));

		const end = start + notes.length * step + 0.12;

		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, end);

		oscillator.connect(gain).connect(this.master!);
		oscillator.start(start);
		oscillator.stop(end);
	}

	/** A rising and falling alarm. */
	private sweep(start: number): void {
		const context = this.context!;
		const oscillator = context.createOscillator();
		const gain = context.createGain();

		oscillator.type = "sawtooth";

		for (let i = 0; i < 3; i++) {
			oscillator.frequency.setValueAtTime(420, start + i * 0.5);
			oscillator.frequency.linearRampToValueAtTime(820, start + i * 0.5 + 0.25);
			oscillator.frequency.linearRampToValueAtTime(420, start + i * 0.5 + 0.5);
		}

		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(0.12, start + 0.05);
		gain.gain.setValueAtTime(0.12, start + 1.35);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.5);

		oscillator.connect(gain).connect(this.master!);
		oscillator.start(start);
		oscillator.stop(start + 1.55);
	}

	/** Filtered noise: water, wind. */
	private hiss(start: number, duration: number, frequency: number): void {
		const context = this.context!;

		if (this.noise === undefined) {
			this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);

			const data = this.noise.getChannelData(0);

			for (let i = 0; i < data.length; i++) {
				data[i] = Math.random() * 2 - 1;
			}
		}

		const source = context.createBufferSource();
		const filter = context.createBiquadFilter();
		const gain = context.createGain();

		source.buffer = this.noise;
		filter.type = "lowpass";
		filter.frequency.setValueAtTime(frequency, start);
		filter.frequency.exponentialRampToValueAtTime(200, start + duration);

		gain.gain.setValueAtTime(0.3, start);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

		source.connect(filter).connect(gain).connect(this.master!);
		source.start(start);
		source.stop(start + duration);
	}

	public destroy(): void {
		void this.context?.close();
	}
}
