import { Howler } from "howler";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { waitForUserGesture } from "../utils/gesture";
export class AudioSystem extends EventEmitter {
    constructor(assets) {
        super();
        this.assets = assets;
        this.initialized = 0;
    }
    async init(settings = {}) {
        if (this.initialized !== 0) {
            throw new Error("AudioSystem is already initialized or destroyed");
        }
        this.initialized = 1;
        if (settings.globalVolume !== undefined)
            this.volume = settings.globalVolume;
        if (settings.muteInitial !== undefined)
            this.muted = settings.muteInitial;
        void waitForUserGesture().then(() => Howler.ctx?.resume());
        this.initialized = 2;
        this.emit("init");
    }
    play(id, spriteId) {
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
    pause(id, playbackId) {
        this.assertInitialized();
        if (id) {
            const sound = this.assets.get("sound", id);
            if (sound) {
                sound.pause(playbackId);
                this.emit("pause", id, playbackId ?? -1);
            }
        }
        else {
            for (const [soundId, howl] of this.assets.cache.entries("sound")) {
                howl.pause();
                this.emit("pause", soundId, -1);
            }
        }
    }
    stop(id, playbackId) {
        this.assertInitialized();
        if (id) {
            const sound = this.assets.get("sound", id);
            if (sound) {
                sound.stop(playbackId);
                this.emit("stop", id, playbackId ?? -1);
            }
        }
        else {
            Howler.stop();
        }
    }
    async destroy() {
        if (this.initialized === 0) {
            throw new Error("AudioSystem is not initialized");
        }
        if (this.initialized === 3) {
            throw new Error("AudioSystem is already destroyed");
        }
        Howler.stop();
        await Howler.ctx?.suspend();
        this.initialized = 3;
        this.emit("destroy");
        this.removeAllListeners();
    }
    set volume(value) {
        const clamped = Math.max(0, Math.min(1, value));
        Howler.volume(clamped);
        this.emit("volume", clamped);
    }
    get volume() {
        return Howler.volume();
    }
    set muted(value) {
        Howler.mute(value);
        this.emit("mute", value);
    }
    get muted() {
        return Howler._muted;
    }
    assertInitialized() {
        if (this.initialized !== 2) {
            throw new Error("AudioSystem is not initialized. Call init() before playing sounds.");
        }
    }
}
