import { afterEach, describe, expect, test } from "bun:test";

const ElementBase = ((globalThis as { Element?: new () => object }).Element ??= class {});

/** An element that is a text field or not, and can be focused. */
class FakeElement extends ElementBase {
	public constructor(
		private readonly field: boolean,
		private readonly page: FakePage,
	) {
		super();
	}

	public closest(): FakeElement | null {
		return this.field ? this : null;
	}

	public focus(): void {
		this.page.activeElement = this;
	}

	public blur(): void {
		if (this.page.activeElement === this) {
			this.page.activeElement = null;
		}
	}
}

class FakePage extends EventTarget {
	public activeElement: FakeElement | null = null;

	public hasFocus(): boolean {
		return true;
	}
}

const { native } = await import("../../client/src/native");

let stop: (() => void) | undefined;

afterEach(() => {
	stop?.();
	stop = undefined;
});

function createPage(focus?: boolean) {
	const page = new FakePage();

	(globalThis as { document?: unknown }).document = page;

	stop = native({ target: page as unknown as Document, viewport: false, focus });

	const press = (target: FakeElement): boolean => {
		const event = new Event("mousedown", { cancelable: true });

		Object.defineProperty(event, "target", { value: target });
		page.dispatchEvent(event);

		return event.defaultPrevented;
	};

	const key = (name: string): boolean => {
		const event = Object.assign(new Event("keydown", { cancelable: true }), { key: name });

		page.dispatchEvent(event);

		return event.defaultPrevented;
	};

	return { page, press, key, button: new FakeElement(false, page), field: new FakeElement(true, page) };
}

describe("native", () => {
	test("Tab moves no focus, and every other key goes through", () => {
		const { key } = createPage();

		expect(key("Tab")).toBe(true);
		expect(key(" ")).toBe(false);
		expect(key("w")).toBe(false);
	});

	test("a press outside a text field takes no focus, and the focused element lets go", () => {
		const { page, press, button, field } = createPage();

		field.focus();

		expect(press(button)).toBe(true);
		expect(page.activeElement).toBeNull();
	});

	test("a press in a text field is left to the browser", () => {
		const { press, field } = createPage();

		expect(press(field)).toBe(false);
	});

	test("with focus off, Tab and presses behave as on any page", () => {
		const { page, press, key, button, field } = createPage(false);

		field.focus();

		expect(key("Tab")).toBe(false);
		expect(press(button)).toBe(false);
		expect(page.activeElement).toBe(field);
	});
});
