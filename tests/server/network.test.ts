import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { field, generate, type Schemas } from "@nasselk/binaryschema";
import { NetworkSystem } from "../../server/src/networking/NetworkSystem";
import type { Schema } from "../../shared/networking/protocol";

let network: NetworkSystem | undefined;

/** A generated schema, which also encodes a message on its own. */
type Generated<T> = Schema<T, T> & { encode(data: T): Uint8Array };

/** The code `binaryschema` would generate for these schemas, loaded: what a game hands the engine. */
async function compile<S>(schemas: Schemas): Promise<S> {
	const folder = await mkdtemp(join(tmpdir(), "schemas-"));
	const file = join(folder, "schemas.gen.ts");

	await writeFile(file, generate(schemas, { runtime: import.meta.resolve("@nasselk/binaryschema/runtime") }));

	try {
		return (await import(pathToFileURL(file).href)).default;
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}

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

	test("an event's size limit defaults to its schema's: a frame outside it closes the socket", async () => {
		const schemas = await compile<{ chat: Generated<{ text: string }> }>({ chat: { fields: { text: field.string({ maxLength: 4 }) } } });
		const heard: string[] = [];

		network = new NetworkSystem({ port: 0, in: { events: ["chat"] as const, schema: schemas }, limits: { chat: { maxRate: 100 } } });
		network.onMessage("chat", (_socket, { text }) => heard.push(text));

		const port = await new Promise<number>((resolve) => {
			network!.on("listening", resolve);
			network!.init();
		});

		const socket = new WebSocket(`ws://localhost:${port}/ws`);
		const closed = new Promise<number>((resolve) => socket.addEventListener("close", (event) => resolve(event.code)));

		await new Promise((resolve) => socket.addEventListener("open", resolve));

		const frame = (payload: Uint8Array) => new Uint8Array([0, ...payload]);

		socket.send(frame(schemas.chat.encode({ text: "hi" })));
		socket.send(frame(new Uint8Array([200, 0, ...new Uint8Array(200)])));

		expect(await closed).toBe(1003);
		expect(heard).toEqual(["hi"]);
	});
});
