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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9TeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jbGllbnQvc3JjL2F1ZGlvL0F1ZGlvU3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDaEMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQVlsRCxNQUFNLENBQU4sSUFBWSxnQkFLWDtBQUxELFdBQVksZ0JBQWdCO0lBQzNCLHVEQUFJLENBQUE7SUFDSix1RUFBWSxDQUFBO0lBQ1oscUVBQVcsQ0FBQTtJQUNYLGlFQUFTLENBQUE7QUFDVixDQUFDLEVBTFcsZ0JBQWdCLEtBQWhCLGdCQUFnQixRQUszQjtBQWNELE1BQU0sT0FBTyxXQUFZLFNBQVEsWUFBK0I7SUFPL0QsWUFBb0MsTUFBb0I7UUFDdkQsS0FBSyxFQUFFLENBQUM7c0JBRDJCLE1BQU07UUFHekMsSUFBSSxDQUFDLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7UUFDekMsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVNLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUEwQixFQUFFO1FBQ3JELElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoRCxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7UUFDcEUsQ0FBQztRQUVELElBQUksQ0FBQyxXQUFXLEdBQUcsZ0JBQWdCLENBQUMsWUFBWSxDQUFDO1FBR2pELElBQUksUUFBUSxDQUFDLFlBQVksS0FBSyxTQUFTO1lBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDO1FBQzdFLElBQUksUUFBUSxDQUFDLFdBQVcsS0FBSyxTQUFTO1lBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDO1FBRTFFLEtBQUssa0JBQWtCLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBRTNELElBQUksQ0FBQyxXQUFXLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDO1FBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQVVNLElBQUksQ0FBQyxFQUFVLEVBQUUsUUFBaUI7UUFDeEMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0NBQW9DLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUN4RSxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFbEMsT0FBTyxVQUFVLENBQUM7SUFDbkIsQ0FBQztJQVFNLEtBQUssQ0FBQyxFQUFXLEVBQUUsVUFBbUI7UUFDNUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUNSLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztZQUUzQyxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUNYLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsRUFBRSxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQyxDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFFUCxLQUFLLE1BQU0sQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2xFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDYixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQyxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFRTSxJQUFJLENBQUMsRUFBVyxFQUFFLFVBQW1CO1FBQzNDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLElBQUksRUFBRSxFQUFFLENBQUM7WUFDUixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFM0MsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUV2QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekMsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2YsQ0FBQztJQUNGLENBQUM7SUFFTSxLQUFLLENBQUMsT0FBTztRQUNuQixJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssZ0JBQWdCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssZ0JBQWdCLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDckQsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFHRCxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFZCxNQUFNLE1BQU0sQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLENBQUM7UUFFNUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUM7UUFDOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUdyQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBT0QsSUFBVyxNQUFNLENBQUMsS0FBYTtRQUU5QixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBRWhELE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFdkIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUtELElBQVcsTUFBTTtRQUNoQixPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBS0QsSUFBVyxLQUFLLENBQUMsS0FBYztRQUM5QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRW5CLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFLRCxJQUFXLEtBQUs7UUFHZixPQUFRLE1BQWMsQ0FBQyxNQUFNLENBQUM7SUFDL0IsQ0FBQztJQUVPLGlCQUFpQjtRQUN4QixJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssZ0JBQWdCLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkQsTUFBTSxJQUFJLEtBQUssQ0FBQyxvRUFBb0UsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7SUFDRixDQUFDO0NBQ0QifQ==