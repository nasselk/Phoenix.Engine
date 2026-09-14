import { error } from "../../../shared";
class InMemoryStorage {
    constructor() {
        this.store = new Map();
    }
    get length() {
        return this.store.size;
    }
    clear() {
        this.store.clear();
    }
    getItem(key) {
        return this.store.get(key) ?? null;
    }
    key(index) {
        return [...this.store.keys()][index] ?? null;
    }
    removeItem(key) {
        this.store.delete(key);
    }
    setItem(key, value) {
        this.store.set(key, value);
    }
}
export let storage = new InMemoryStorage();
export function setStorage(repository) {
    storage = repository;
}
try {
    setStorage(localStorage);
}
catch {
    try {
        error("Storage", "LocalStorage is not available, using sessionStorage instead");
        setStorage(sessionStorage);
    }
    catch {
        error("Storage", "SessionStorage is not available, using in-memory storage instead");
    }
}
