import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { closestServer, findRoomServer, getCountryCode, listServers, type Server } from "../../client/src/networking/servers";

const paris: Server = { id: "eu", name: "Paris", url: "https://eu.example", countryCode: "FR" };
const virginia: Server = { id: "us", name: "Virginia", url: "https://us.example", countryCode: "US" };
const tokyo: Server = { id: "asia", name: "Tokyo", url: "https://asia.example", countryCode: "JP" };

afterEach(() => mock.restore());

describe("listServers", () => {
	test("flattens every mode and region into one list", () => {
		expect(listServers({ duel: { eu: [paris], us: [virginia] }, team: { asia: [tokyo] } })).toEqual([paris, virginia, tokyo]);
	});
});

describe("closestServer", () => {
	test("picks the server whose country is nearest the player's, skipping servers with no country", () => {
		const unplaced: Server = { id: "x", name: "Unplaced", url: "https://x.example" };

		expect(closestServer([virginia, unplaced, paris, tokyo], "DE")).toBe(paris);
		expect(closestServer([paris, virginia, tokyo], "CA")).toBe(virginia);
		expect(closestServer([paris, virginia, tokyo], "KR")).toBe(tokyo);
	});

	test("picks the first server when the player's country is unknown", () => {
		expect(closestServer([virginia, paris])).toBe(virginia);
		expect(closestServer([])).toBeUndefined();
	});
});

describe("getCountryCode", () => {
	test("reads the country from Cloudflare's trace, and is undefined when it cannot", async () => {
		const fetch = spyOn(globalThis, "fetch").mockResolvedValue(new Response("ip=1.2.3.4\nloc=FR\ntls=TLSv1.3\n"));

		expect(await getCountryCode(true)).toBe("FR");
		expect(String(fetch.mock.calls[0]![0])).toBe("/cdn-cgi/trace");

		fetch.mockResolvedValue(new Response("loc=XX\n"));

		expect(await getCountryCode()).toBeUndefined();
		expect(String(fetch.mock.calls[1]![0])).toBe("https://www.cloudflare.com/cdn-cgi/trace");

		fetch.mockRejectedValue(new Error("offline"));

		expect(await getCountryCode()).toBeUndefined();
	});
});

describe("findRoomServer", () => {
	test("answers with the server that has the room, and undefined when none has it", async () => {
		spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);

			return url.startsWith(virginia.url) && url.includes("/rooms/ABCD") ? Response.json({ players: 2, maxPlayers: 8, public: false }) : new Response("Not found", { status: 404 });
		});

		expect(await findRoomServer([paris, virginia, tokyo], "ABCD")).toBe(virginia);
		expect(await findRoomServer([paris, virginia, tokyo], "ZZZZ")).toBeUndefined();
	});
});
