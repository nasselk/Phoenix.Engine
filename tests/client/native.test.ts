import { afterEach, describe, expect, test } from "bun:test";

const { native } = await import("../../client/src/native");

let stop: (() => void) | undefined;

afterEach(() => {
	stop?.();
	stop = undefined;
});

function createPage(focus?: boolean) {
	const page = new EventTarget();

	stop = native({ target: page as unknown as Document, viewport: false, focus });

	return (name: string): boolean => {
		const event = Object.assign(new Event("keydown", { cancelable: true }), { key: name });

		page.dispatchEvent(event);

		return event.defaultPrevented;
	};
}

describe("native", () => {
	test("Tab moves no focus, and every other key goes through", () => {
		const key = createPage();

		expect(key("Tab")).toBe(true);
		expect(key(" ")).toBe(false);
		expect(key("w")).toBe(false);
	});

	test("with focus off, Tab moves focus as on any page", () => {
		const key = createPage(false);

		expect(key("Tab")).toBe(false);
	});
});
