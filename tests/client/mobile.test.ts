import { afterEach, describe, expect, test } from "bun:test";
import { isMobileDevice } from "../../client/src/utils/mobile";

const original = { navigator: globalThis.navigator, matchMedia: (globalThis as any).matchMedia, screen: (globalThis as any).screen };

/** Pretends to be a device: its user agent, its touch points, whether its main pointer is a finger, and its screen size. */
function device(userAgent: string, { touchPoints = 0, coarse = false, width = 1920, height = 1080 } = {}) {
	Object.defineProperty(globalThis, "navigator", { value: { userAgent, maxTouchPoints: touchPoints }, configurable: true });
	Object.defineProperty(globalThis, "matchMedia", { value: (query: string) => ({ matches: query === "(pointer: coarse)" && coarse }), configurable: true });
	Object.defineProperty(globalThis, "screen", { value: { width, height }, configurable: true });

	return isMobileDevice();
}

afterEach(() => {
	for (const [name, value] of Object.entries(original)) {
		Object.defineProperty(globalThis, name, { value, configurable: true });
	}
});

describe("isMobileDevice", () => {
	test("phones are mobile", () => {
		const phones = [
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
			"Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
		];

		for (const userAgent of phones) {
			expect(device(userAgent, { touchPoints: 5, coarse: true, width: 390, height: 844 })).toEqual({ mobile: true, tablet: false, any: true });
		}
	});

	test("tablets are tablets, iPads on iPadOS's desktop user agent included", () => {
		const tablets = [
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
			"Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1",
			"Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Android 14; Tablet; rv:127.0) Gecko/127.0 Firefox/127.0",
			"Mozilla/5.0 (Linux; Android 11; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.4.1 like Chrome/126.0.0.0 Safari/537.36",
		];

		for (const userAgent of tablets) {
			expect(device(userAgent, { touchPoints: 5, coarse: true, width: 820, height: 1180 })).toEqual({ mobile: false, tablet: true, any: true });
		}
	});

	test("a touch screen its user agent does not name counts by its pointer and its size", () => {
		const desktopSite = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

		expect(device(desktopSite, { touchPoints: 10, coarse: true, width: 800, height: 1280 }).tablet).toBe(true);
		expect(device(desktopSite, { touchPoints: 10, coarse: true, width: 412, height: 915 }).mobile).toBe(true);
	});

	test("desktops are neither, even with a touch screen driven by a mouse", () => {
		const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
		const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

		expect(device(windows).any).toBe(false);
		expect(device(windows, { touchPoints: 10, coarse: false }).any).toBe(false);
		expect(device(mac).any).toBe(false);
	});
});
