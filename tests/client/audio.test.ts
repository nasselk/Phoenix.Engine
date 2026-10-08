import { describe, expect, test } from "bun:test";
import { encodeWav, type PCMSource } from "../../client/src/audio/lib/SoundBuilder";

function source(sampleRate: number, ...channels: number[][]): PCMSource {
	return {
		sampleRate,
		numberOfChannels: channels.length,
		length: channels[0]!.length,
		getChannelData: (channel) => Float32Array.from(channels[channel]!),
	};
}

function ascii(view: DataView, offset: number, length: number): string {
	return String.fromCharCode(...new Uint8Array(view.buffer, offset, length));
}

describe("encodeWav", () => {
	test("writes a 16-bit PCM header describing the samples", () => {
		const view = new DataView(encodeWav(source(22050, [0, 0, 0], [0, 0, 0])));

		expect(ascii(view, 0, 4)).toBe("RIFF");
		expect(view.getUint32(4, true)).toBe(36 + 12);
		expect(ascii(view, 8, 8)).toBe("WAVEfmt ");
		expect(view.getUint16(20, true)).toBe(1);
		expect(view.getUint16(22, true)).toBe(2);
		expect(view.getUint32(24, true)).toBe(22050);
		expect(view.getUint32(28, true)).toBe(22050 * 4);
		expect(view.getUint16(32, true)).toBe(4);
		expect(view.getUint16(34, true)).toBe(16);
		expect(ascii(view, 36, 4)).toBe("data");
		expect(view.getUint32(40, true)).toBe(12);
		expect(view.byteLength).toBe(44 + 12);
	});

	test("interleaves channels and clamps samples to the 16-bit range", () => {
		const view = new DataView(encodeWav(source(44100, [1, -1, 2], [0.5, -2, 0])));
		const samples = Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true));

		expect(samples).toEqual([32767, 16383, -32768, -32768, 32767, 0]);
	});
});
