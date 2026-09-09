export class CounterMap<K> {
	private readonly map: Map<K, number>;
	private readonly min: number;
	private readonly max: number;

	constructor(min: number = 0, max: number = Infinity) {
		this.map = new Map();
		this.min = min;
		this.max = max;
	}

	public increment(key: K, amount: number = 1): number {
		const current = this.getCount(key);
		const newValue = current + amount;

		this.map.set(key, newValue);

		return newValue;
	}

	public decrement(key: K, amount: number = 1): number {
		const current = this.getCount(key);
		const newValue = current - amount;

		if (newValue <= 0) {
			this.map.delete(key);
		} else {
			this.map.set(key, newValue);
		}

		return newValue;
	}

	public delete(key: K): boolean {
		return this.map.delete(key);
	}

	public getCount(key: K): number {
		return this.map.get(key) ?? 0;
	}

	public has(key: K): boolean {
		return this.map.has(key);
	}

	public outOfBounds(key: K, min: number = this.min, max: number = this.max): boolean {
		const count = this.getCount(key);

		return count < min || count > max;
	}

	public clear(): void {
		this.map.clear();
	}
}
