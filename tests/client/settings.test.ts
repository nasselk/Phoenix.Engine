import { afterEach, describe, expect, test } from "bun:test";
import { SettingsStorage } from "../../client/src/utils/settings";
import { storage } from "../../client/src/utils/storage";

const KEY = "settings";

function defaults() {
	return { audio: { volume: 0.5, muted: false }, binds: { jump: ["Space"] }, name: "" };
}

afterEach(() => storage.removeItem(KEY));

describe("SettingsStorage", () => {
	test("loads the defaults with what storage holds merged over them, and ignores what it cannot read", () => {
		expect(new SettingsStorage(KEY, defaults()).load()).toEqual(defaults());

		storage.setItem(KEY, JSON.stringify({ audio: { volume: 0.2 } }));

		expect(new SettingsStorage(KEY, defaults()).load()).toEqual({ ...defaults(), audio: { volume: 0.2, muted: false } });

		storage.setItem(KEY, "{ not json");

		expect(new SettingsStorage(KEY, defaults()).load()).toEqual(defaults());
	});

	test("writes only what differs from the defaults, and keeps a written key once it is set back to its default", () => {
		const store = new SettingsStorage(KEY, defaults());
		const values = store.load();

		store.save(values);

		expect(JSON.parse(storage.getItem(KEY)!)).toEqual({});

		values.audio.volume = 0.8;
		values.binds.jump = ["KeyW"];
		store.save(values);

		expect(JSON.parse(storage.getItem(KEY)!)).toEqual({ audio: { volume: 0.8 }, binds: { jump: ["KeyW"] } });
		expect(store.stored("audio.volume")).toBe(0.8);
		expect(store.stored("audio.muted")).toBeUndefined();

		values.audio.volume = 0.5;
		store.save(values);

		expect(JSON.parse(storage.getItem(KEY)!)).toEqual({ audio: { volume: 0.5 }, binds: { jump: ["KeyW"] } });
	});

	test("reset puts the values back to the defaults, forgets storage, and leaves the defaults untouched", () => {
		const store = new SettingsStorage(KEY, defaults());
		const values = store.load();

		values.binds.jump.push("KeyW");
		values.name = "player";
		store.save(values);
		store.reset(values);

		expect(values).toEqual(defaults());
		expect(storage.getItem(KEY)).toBeNull();
		expect(store.stored("name")).toBeUndefined();

		values.binds.jump.push("KeyX");

		expect(store.defaults).toEqual(defaults());
	});
});
