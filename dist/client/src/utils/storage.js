import { error } from "../../../shared/utils/logger";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2NsaWVudC9zcmMvdXRpbHMvc3RvcmFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFckQsTUFBTSxlQUFlO0lBQXJCO1FBQ2tCLFVBQUssR0FBd0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQXlCekQsQ0FBQztJQXZCQSxJQUFXLE1BQU07UUFDaEIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztJQUN4QixDQUFDO0lBRU0sS0FBSztRQUNYLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVNLE9BQU8sQ0FBQyxHQUFXO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ3BDLENBQUM7SUFFTSxHQUFHLENBQUMsS0FBYTtRQUN2QixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzlDLENBQUM7SUFFTSxVQUFVLENBQUMsR0FBVztRQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRU0sT0FBTyxDQUFDLEdBQVcsRUFBRSxLQUFhO1FBQ3hDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM1QixDQUFDO0NBQ0Q7QUFFRCxNQUFNLENBQUMsSUFBSSxPQUFPLEdBQVksSUFBSSxlQUFlLEVBQUUsQ0FBQztBQUVwRCxNQUFNLFVBQVUsVUFBVSxDQUFDLFVBQW1CO0lBQzdDLE9BQU8sR0FBRyxVQUFVLENBQUM7QUFDdEIsQ0FBQztBQUVELElBQUksQ0FBQztJQUNKLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUMxQixDQUFDO0FBQUMsTUFBTSxDQUFDO0lBQ1IsSUFBSSxDQUFDO1FBQ0osS0FBSyxDQUFDLFNBQVMsRUFBRSw2REFBNkQsQ0FBQyxDQUFDO1FBRWhGLFVBQVUsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1IsS0FBSyxDQUFDLFNBQVMsRUFBRSxrRUFBa0UsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7QUFDRixDQUFDIn0=