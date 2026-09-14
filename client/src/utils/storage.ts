import { error } from "../../../shared";

class InMemoryStorage implements Storage {
	private readonly store: Map<string, string> = new Map();

	public get length(): number {
		return this.store.size;
	}

	public clear(): void {
		this.store.clear();
	}

	public getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	public key(index: number): string | null {
		return [...this.store.keys()][index] ?? null;
	}

	public removeItem(key: string): void {
		this.store.delete(key);
	}

	public setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
}

export let storage: Storage = new InMemoryStorage();

export function setStorage(repository: Storage): void {
	storage = repository;
}

try {
	setStorage(localStorage);
} catch {
	try {
		error("Storage", "LocalStorage is not available, using sessionStorage instead");

		setStorage(sessionStorage);
	} catch {
		error("Storage", "SessionStorage is not available, using in-memory storage instead");
	}
}
