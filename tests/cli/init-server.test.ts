import { describe, expect, test } from "bun:test";
import path from "node:path";
import { appName, planServers } from "../../cli/init-server";

describe("planServers", () => {
	test("lists each host once, with its own key or the shared one, and every port its instances use across targets", () => {
		const dir = path.resolve("scripts");
		const plans = planServers(
			{
				key: "../.keys/ssh",
				targets: {
					production: {
						servers: [
							{
								user: "ubuntu",
								host: "1.1.1.1",
								instances: [
									{ name: "eu-1", port: 443 },
									{ name: "eu-2", port: 8443 },
								],
							},
							{ user: "root", host: "2.2.2.2", key: "../.keys/other", instances: [{ name: "us-1" }] },
						],
					},
					beta: {
						servers: [
							{
								user: "ubuntu",
								host: "1.1.1.1",
								instances: [
									{ name: "beta-1", port: 9443 },
									{ name: "beta-2", port: 443 },
								],
							},
						],
					},
				},
			},
			dir,
		);

		expect(plans).toEqual([
			{ host: "1.1.1.1", user: "ubuntu", key: path.resolve(dir, "../.keys/ssh"), ports: [443, 8443, 9443] },
			{ host: "2.2.2.2", user: "root", key: path.resolve(dir, "../.keys/other"), ports: [443] },
		]);
	});
});

describe("appName", () => {
	test("turns a package name into lowercase letters, digits and dashes, and falls back to game", () => {
		expect(appName("phoenix.engine-template")).toBe("phoenix-engine-template");
		expect(appName("@studio/My Game!")).toBe("studio-my-game");
		expect(appName(undefined)).toBe("game");
		expect(appName("___")).toBe("game");
	});
});
