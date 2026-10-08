import { Howler } from "howler";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { waitForUserGesture } from "../utils/gesture";
import { SoundBuilder } from "./lib/SoundBuilder";
export var AudioSystemState;
(function (AudioSystemState) {
    AudioSystemState[AudioSystemState["NULL"] = 0] = "NULL";
    AudioSystemState[AudioSystemState["INITIALIZING"] = 1] = "INITIALIZING";
    AudioSystemState[AudioSystemState["INITIALIZED"] = 2] = "INITIALIZED";
    AudioSystemState[AudioSystemState["DESTROYED"] = 3] = "DESTROYED";
})(AudioSystemState || (AudioSystemState = {}));
export class AudioSystem extends EventEmitter {
    constructor(assets) {
        super();
        this.assets = assets;
        this.initialized = AudioSystemState.NULL;
        this.soundBuilder = new SoundBuilder(assets.cache);
    }
    async init(settings = {}) {
        if (this.initialized !== AudioSystemState.NULL) {
            throw new Error("AudioSystem is already initialized or destroyed");
        }
        this.initialized = AudioSystemState.INITIALIZING;
        if (settings.globalVolume !== undefined)
            this.volume = settings.globalVolume;
        if (settings.muteInitial !== undefined)
            this.muted = settings.muteInitial;
        void waitForUserGesture().then(() => Howler.ctx?.resume());
        this.initialized = AudioSystemState.INITIALIZED;
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
        if (this.initialized === AudioSystemState.NULL) {
            throw new Error("AudioSystem is not initialized");
        }
        if (this.initialized === AudioSystemState.DESTROYED) {
            throw new Error("AudioSystem is already destroyed");
        }
        Howler.stop();
        await Howler.ctx?.suspend();
        this.initialized = AudioSystemState.DESTROYED;
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
        if (this.initialized !== AudioSystemState.INITIALIZED) {
            throw new Error("AudioSystem is not initialized. Call init() before playing sounds.");
        }
    }
}
