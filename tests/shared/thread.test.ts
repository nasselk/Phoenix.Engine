import { describe, expect, test } from "bun:test";
import { Thread } from "../../shared/utils/thread";

export type Messages = {
	echo: { data: string };
	double: { data: number; response: number };
	fill: { data: number; response: ArrayBuffer };
	slow: { data: undefined; response: string };
	fail: { data: undefined; response: never };
};

function pair(): [Thread<Messages>, Thread<Messages>] {
	const [a, b] = Thread.getChannel();

	return [new Thread<Messages>(a), new Thread<Messages>(b)];
}

function next<T>(thread: Thread<Messages>, event: "echo"): Promise<T> {
	return new Promise((resolve) => {
		const stop = thread.on(event, (data) => {
			stop();
			resolve(data as T);
		});
	});
}

describe("Thread", () => {
	test("delivers a sent event to every listener until it unsubscribes", async () => {
		const [a, b] = pair();
		const heard: string[] = [];

		const stop = b.on("echo", (text) => heard.push(`first ${text}`));
		b.on("echo", (text) => heard.push(`second ${text}`));

		a.send("echo", "one");
		await next(b, "echo");
		stop();
		a.send("echo", "two");
		await next(b, "echo");

		expect(heard).toEqual(["first one", "second one", "second two"]);

		a.terminate();
		b.terminate();
	});

	test("a request resolves with what the handler returns, and transfers what it pushes", async () => {
		const [a, b] = pair();

		b.onRequest("double", async (value) => value * 2);
		b.onRequest("fill", (size, transfer) => {
			const buffer = new ArrayBuffer(size);

			transfer.push(buffer);

			return buffer;
		});

		expect(await Promise.all([a.request("double", 2), a.request("double", 21)])).toEqual([4, 42]);
		expect((await a.request("fill", 8)).byteLength).toBe(8);

		a.terminate();
		b.terminate();
	});

	test("a request rejects when the handler throws or there is none", async () => {
		const [a, b] = pair();

		b.onRequest("fail", () => {
			throw new Error("refused");
		});

		await expect(a.request("fail", undefined)).rejects.toThrow("refused");
		await expect(a.request("double", 1)).rejects.toThrow('No handler for requests of "double"');
		expect(() => b.onRequest("fail", () => undefined as never)).toThrow();

		a.terminate();
		b.terminate();
	});

	test("a request rejects after its timeout, and its late answer is ignored", async () => {
		const [a, b] = pair();

		b.onRequest("slow", () => new Promise((resolve) => setTimeout(() => resolve("late"), 50)));
		b.onRequest("double", (value) => value * 2);

		await expect(a.request("slow", undefined, { timeout: 10 })).rejects.toThrow("timed out after 10 ms");
		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(await a.request("double", 5)).toBe(10);

		a.terminate();
		b.terminate();
	});

	test("terminate rejects the requests still waiting, and every later one", async () => {
		const [a, b] = pair();

		b.onRequest("slow", () => new Promise(() => {}));

		const waiting = a.request("slow", undefined);

		a.terminate();

		await expect(waiting).rejects.toThrow("terminated");
		await expect(a.request("slow", undefined)).rejects.toThrow("terminated");

		b.terminate();
	});

	test("talks to a worker through Thread.parent, and parent throws outside a worker", async () => {
		const worker = new Thread<Messages>(new Worker(new URL("./thread.worker.ts", import.meta.url)));
		const echoed = next<string>(worker, "echo");

		worker.send("echo", "hello");

		expect(await worker.request("double", 21, { timeout: 5000 })).toBe(42);
		expect(await echoed).toBe("hello");
		expect(() => Thread.parent()).toThrow("only available inside a worker");

		worker.terminate();
	});
});
