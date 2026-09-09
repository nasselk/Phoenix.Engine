import { Howl, Howler } from "howler";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
export class AudioSystem extends EventEmitter {
    constructor() {
        super();
        this.initialized = 0;
        this.sounds = new Map();
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
        await Howler.ctx?.resume();
        this.initialized = 2;
        this.emit("init");
    }
    load(id, src, options = {}) {
        if (this.sounds.has(id)) {
            console.warn(`AudioSystem: Sound with id '${id}' is already loaded. Returning existing Howl.`);
            return this.sounds.get(id);
        }
        const howl = new Howl({
            src: Array.isArray(src) ? src : [src],
            ...options,
        });
        this.sounds.set(id, howl);
        return howl;
    }
    remove(id) {
        const sound = this.sounds.get(id);
        if (sound) {
            sound.unload();
            this.sounds.delete(id);
        }
    }
    play(id, spriteId) {
        this.assertInitialized();
        const sound = this.sounds.get(id);
        if (!sound) {
            console.error(`AudioSystem: Cannot play. Sound '${id}' not found.`);
            return undefined;
        }
        const playbackId = sound.play(spriteId);
        this.emit("play", id, playbackId);
        return playbackId;
    }
    pause(id, playbackId) {
        this.assertInitialized();
        if (id) {
            const sound = this.sounds.get(id);
            if (sound) {
                sound.pause(playbackId);
                this.emit("pause", id, playbackId ?? -1);
            }
        }
        else {
            for (const [soundId, howl] of this.sounds.entries()) {
                howl.pause();
                this.emit("pause", soundId, -1);
            }
        }
    }
    stop(id, playbackId) {
        this.assertInitialized();
        if (id) {
            const sound = this.sounds.get(id);
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
        for (const howl of this.sounds.values()) {
            howl.unload();
        }
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
