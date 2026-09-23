import { Howler } from "howler";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import type { AssetManager } from "../assets/AssetManager";
import { waitForUserGesture } from "../utils/gesture";

type AudioSystemEvents = {
	init: [];
	play: [id: string, soundId: number];
	pause: [id: string, soundId: number];
	stop: [id: string, soundId: number];
	mute: [isMuted: boolean];
	volume: [level: number];
	destroy: [];
};

export const enum AudioSystemState {
	NULL,
	INITIALIZING,
	INITIALIZED,
	DESTROYED,
}

export interface AudioOptions {
	globalVolume: number;
	muteInitial: boolean;
}

/**
 * Plays sounds, and holds the volume, the mute and the audio context. Sounds are loaded through
 * the asset manager, as the `sound` kind, and played by the id they were loaded under:
 *
 *   await engine.assets.load("sound", "jump", "/sounds/jump.webm");
 *   engine.audio.play("jump");
 */
export class AudioSystem extends EventEmitter<AudioSystemEvents> {
	/** The current state of the rendering system. */
	public initialized: AudioSystemState;

	public constructor(private readonly assets: AssetManager) {
		super();

		this.initialized = AudioSystemState.NULL;
	}

	public async init(settings: Partial<AudioOptions> = {}): Promise<void> {
		if (this.initialized !== AudioSystemState.NULL) {
			throw new Error("AudioSystem is already initialized or destroyed");
		}

		this.initialized = AudioSystemState.INITIALIZING;

		// Apply initial settings
		if (settings.globalVolume !== undefined) this.volume = settings.globalVolume;
		if (settings.muteInitial !== undefined) this.muted = settings.muteInitial;

		void waitForUserGesture().then(() => Howler.ctx?.resume());

		this.initialized = AudioSystemState.INITIALIZED;
		this.emit("init");
	}

	/**
	 * Plays a previously loaded sound.
	 *
	 * @param id The unique identifier of the sound.
	 * @param spriteId Optional sprite identifier if playing a specific audio sprite.
	 * @returns The specific playback ID of the sound, or undefined if the sound wasn't found.
	 * @throws Error if the audio system is not initialized.
	 */
	public play(id: string, spriteId?: string): number | undefined {
		this.assertInitialized();

		const sound = this.assets.get("sound", id);
		if (!sound) {
			console.error(`AudioSystem: Cannot play. Sound '${id}' is not loaded.`);
			return undefined;
		}

		const playbackId = sound.play(spriteId);
		this.emit("play", id, playbackId);

		return playbackId;
	}

	/**
	 * Pauses a currently playing sound. If no ID is provided, pauses all sounds.
	 *
	 * @param id The unique identifier of the sound.
	 * @param playbackId Optional specific playback ID to pause.
	 */
	public pause(id?: string, playbackId?: number): void {
		this.assertInitialized();

		if (id) {
			const sound = this.assets.get("sound", id);

			if (sound) {
				sound.pause(playbackId);
				this.emit("pause", id, playbackId ?? -1);
			}
		} else {
			// Pause globally if no ID is passed
			for (const [soundId, howl] of this.assets.cache.entries("sound")) {
				howl.pause();
				this.emit("pause", soundId, -1);
			}
		}
	}

	/**
	 * Stops a currently playing sound entirely. If no ID is provided, stops all sounds.
	 *
	 * @param id The unique identifier of the sound.
	 * @param playbackId Optional specific playback ID to stop.
	 */
	public stop(id?: string, playbackId?: number): void {
		this.assertInitialized();

		if (id) {
			const sound = this.assets.get("sound", id);

			if (sound) {
				sound.stop(playbackId);

				this.emit("stop", id, playbackId ?? -1);
			}
		} else {
			Howler.stop();
		}
	}

	public async destroy(): Promise<void> {
		if (this.initialized === AudioSystemState.NULL) {
			throw new Error("AudioSystem is not initialized");
		}

		if (this.initialized === AudioSystemState.DESTROYED) {
			throw new Error("AudioSystem is already destroyed");
		}

		// The sounds themselves are the asset cache's, and are unloaded with it.
		Howler.stop();

		await Howler.ctx?.suspend();

		this.initialized = AudioSystemState.DESTROYED;
		this.emit("destroy");

		// Clean up event listeners from the base class
		this.removeAllListeners();
	}

	/**
	 * Sets the global master volume for all sounds.
	 *
	 * @param value A number from 0.0 to 1.0.
	 */
	public set volume(value: number) {
		// Clamp between 0 and 1
		const clamped = Math.max(0, Math.min(1, value));

		Howler.volume(clamped);

		this.emit("volume", clamped);
	}

	/**
	 * Gets the current global master volume.
	 */
	public get volume(): number {
		return Howler.volume();
	}

	/**
	 * Mutes or unmutes all sounds globally.
	 */
	public set muted(value: boolean) {
		Howler.mute(value);

		this.emit("mute", value);
	}

	/**
	 * Checks if the global audio is currently muted.
	 */
	public get muted(): boolean {
		// howler.js doesn't natively expose a getter for mute state easily,
		// so we check if the internal _muted flag is true.
		return (Howler as any)._muted;
	}

	private assertInitialized(): void {
		if (this.initialized !== AudioSystemState.INITIALIZED) {
			throw new Error("AudioSystem is not initialized. Call init() before playing sounds.");
		}
	}
}
