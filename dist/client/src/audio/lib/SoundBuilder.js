import { SoundLoader } from "../../assets/loaders/sound";
export function encodeWav(source) {
    const channels = source.numberOfChannels;
    const dataSize = source.length * channels * 2;
    const view = new DataView(new ArrayBuffer(44 + dataSize));
    const text = (offset, value) => {
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
    const data = [];
    for (let channel = 0; channel < channels; channel++) {
        data.push(source.getChannelData(channel));
    }
    let offset = 44;
    for (let i = 0; i < source.length; i++) {
        for (let channel = 0; channel < channels; channel++) {
            const sample = Math.max(-1, Math.min(1, data[channel][i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }
    return view.buffer;
}
export class SoundBuilder {
    constructor(cache, sampleRate = 44100) {
        this.layers = [];
        this.end = 0;
        this.cache = cache;
        this.loader = new SoundLoader();
        this.sampleRate = sampleRate;
    }
    get duration() {
        return this.end;
    }
    layer(end, build) {
        this.layers.push(build);
        this.end = Math.max(this.end, end);
        return this;
    }
    tone(type, notes, step, volume = 0.2, start = 0) {
        const end = start + notes.length * step + 0.12;
        return this.layer(end, (context, output) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = type;
            for (let i = 0; i < notes.length; i++) {
                oscillator.frequency.setValueAtTime(notes[i], start + i * step);
            }
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);
            oscillator.connect(gain).connect(output);
            oscillator.start(start);
            oscillator.stop(end);
        });
    }
    sweep(type, low, high, period, repeat = 1, volume = 0.12, start = 0) {
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
    noise(duration, from = 1800, to = 200, volume = 0.3, start = 0) {
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
    async render() {
        const layers = this.layers;
        const length = Math.max(1, Math.ceil(this.end * this.sampleRate));
        this.clear();
        const context = new OfflineAudioContext(1, length, this.sampleRate);
        for (const layer of layers) {
            layer(context, context.destination);
        }
        return context.startRendering();
    }
    async save(name) {
        const blob = new Blob([encodeWav(await this.render())], { type: "audio/wav" });
        const howl = await this.loader.load({ src: await dataURL(blob), format: ["wav"] });
        if (name) {
            this.cache.set("sound", name, howl);
        }
        return howl;
    }
    async download(name) {
        const blob = new Blob([encodeWav(await this.render())], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.wav`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    clear() {
        this.layers = [];
        this.end = 0;
        return this;
    }
}
function dataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
