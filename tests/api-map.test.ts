import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const map = readFileSync(join(root, "API.md"), "utf8");

function resolveModule(from: string, specifier: string): string {
	const base = resolve(dirname(from), specifier);

	return [`${base}.ts`, join(base, "index.ts")].find(existsSync) ?? base;
}

function exportsOf(file: string): Set<string> {
	const source = readFileSync(file, "utf8");
	const names = new Set<string>();

	for (const [, specifier] of source.matchAll(/export \* from "([^"]+)"/g)) {
		for (const name of exportsOf(resolveModule(file, specifier!))) {
			names.add(name);
		}
	}

	for (const [, list] of source.matchAll(/export (?:type )?\{([^}]*)\} from/g)) {
		for (const entry of list!.split(",")) {
			const name = entry
				.replace(/^\s*type\s+/, "")
				.split(/\s+as\s+/)
				.pop()!
				.trim();

			if (name !== "") {
				names.add(name);
			}
		}
	}

	return names;
}

function missing(names: Iterable<string>): string[] {
	return [...names].filter((name) => !new RegExp(`\\b${name}\\b`).test(map));
}

describe("API.md", () => {
	for (const entry of ["shared/index.ts", "client/src/index.ts", "server/src/index.ts", "client/src/text/index.ts"]) {
		test(`lists every export of ${entry}`, () => {
			expect(missing(exportsOf(join(root, entry)))).toEqual([]);
		});
	}

	test("lists every UI component", () => {
		expect(missing(readdirSync(join(root, "client/UI/components")))).toEqual([]);
	});
});
