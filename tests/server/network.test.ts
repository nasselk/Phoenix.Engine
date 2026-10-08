import { afterEach, describe, expect, test } from "bun:test";
import { NetworkSystem } from "../../server/src/networking/NetworkSystem";

let network: NetworkSystem | undefined;

/** A server on a free port, accepting sockets from that origin only. */
async function listen(): Promise<number> {
	network = new NetworkSystem({ port: 0, origins: "https://game.example" });

	const port = new Promise<number>((resolve) => network!.on("listening", resolve));

	network.init();

	return port;
}

/** Opens a socket from that origin: whether it opened, or was refused. */
function open(port: number, origin: string): Promise<boolean> {
	const socket = new WebSocket(`ws://localhost:${port}/ws`, { headers: { origin } } as never);

	return new Promise((resolve) => {
		socket.addEventListener("open", () => {
			socket.close();
			resolve(true);
		});
		socket.addEventListener("error", () => resolve(false));
	});
}

afterEach(() => {
	network?.destroy();
	network = undefined;
});

describe("NetworkSystem", () => {
	test("a socket opens from an allowed origin, and is refused from any other", async () => {
		const port = await listen();

		expect(await open(port, "https://game.example")).toBe(true);
		expect(await open(port, "https://elsewhere.example")).toBe(false);
	});
});
