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

	test("a click on a button or link takes no focus, and one in a text field or elsewhere does", () => {
		/** An element that is inside whatever the selectors in `within` match. */
		class Element {
			public constructor(private readonly within: string[]) {}

			public closest(selectors: string): this | null {
				return selectors.split(",").some((selector) => this.within.includes(selector.trim())) ? this : null;
			}
		}

		const original = (globalThis as { Element?: unknown }).Element;
		const page = new EventTarget();

		(globalThis as { Element?: unknown }).Element = Element;
		stop = native({ target: page as unknown as Document, viewport: false });

		const click = (within: string[]): boolean => {
			const event = new Event("mousedown", { cancelable: true });

			Object.defineProperty(event, "target", { value: new Element(within) });
			page.dispatchEvent(event);

			return event.defaultPrevented;
		};

		try {
			expect(click(["button"])).toBe(true);
			expect(click(["a"])).toBe(true);
			expect(click(["input"])).toBe(false);
			expect(click(["button", "input"])).toBe(false);
			expect(click([])).toBe(false);
		} finally {
			(globalThis as { Element?: unknown }).Element = original;
		}
	});
});
