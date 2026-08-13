export class IDAllocator {
	private readonly positiveIDsPool: number[];
	private readonly negativeIDsPool: number[];
	private nextPositiveID: number;
	private nextNegativeID: number;

	// Deferred frees: ids waiting out a reuse delay before returning to the pool.
	// Parallel arrays used as a FIFO with a moving head — see freeWithTimeout.
	private readonly timedIDs: number[];
	private readonly timedFreeAt: number[];
	private timedHead: number;

	public constructor() {
		this.positiveIDsPool = [];
		this.negativeIDsPool = [];
		this.nextPositiveID = 1;
		this.nextNegativeID = -1;
		this.timedIDs = [];
		this.timedFreeAt = [];
		this.timedHead = 0;
	}

	public allocate(): number {
		if (this.positiveIDsPool.length > 0) {
			return this.positiveIDsPool.pop()!;
		} else {
			return this.nextPositiveID++;
		}
	}

	public allocateNegative(): number {
		if (this.negativeIDsPool.length > 0) {
			return this.negativeIDsPool.pop()!;
		} else {
			return this.nextNegativeID--;
		}
	}

	public free(...ids: number[]): this {
		for (const id of ids) {
			if (id > 0) {
				if (id < this.nextPositiveID) {
					this.positiveIDsPool.push(id);
				}
			} else {
				if (id > this.nextNegativeID) {
					this.negativeIDsPool.push(id);
				}
			}
		}

		return this;
	}

	/**
	 * Free `id`, but only after `delay` ms. The id stays reserved until then so a
	 * recycled id can't collide with something still referencing the old one
	 * (e.g. a client death animation playing on the destroyed entity).
	 *
	 * Cheaper than one timer per id: all deferred frees share this queue, and
	 * `processTimeouts` only touches the ones that are actually due. Because every
	 * call stamps `now + delay` from a monotonic clock, `freeAt` is non-decreasing,
	 * so the queue stays ordered and the drain only ever checks the head.
	 */
	public freeWithTimeout(id: number, delay: number = 2500, now: number = performance.now()): this {
		this.timedIDs.push(id);
		this.timedFreeAt.push(now + delay);

		return this;
	}

	/**
	 * Return every timed-free id whose delay has elapsed at `now` to the pool, in
	 * enqueue order. Call once per tick. Stops at the first not-yet-due entry since
	 * the queue is ordered by `freeAt`, so it's O(ids actually freed), not O(pending).
	 */
	public processTimeouts(now: number = performance.now()): this {
		const ids = this.timedIDs;
		const freeAt = this.timedFreeAt;
		let head = this.timedHead;

		while (head < ids.length && freeAt[head] <= now) {
			this.free(ids[head]);

			head++;
		}

		this.timedHead = head;

		// Reclaim the consumed prefix once it dominates the backing arrays so they
		// don't retain already-freed ids indefinitely under sustained churn.
		if (head > 1024 && head * 2 >= ids.length) {
			ids.splice(0, head);
			freeAt.splice(0, head);

			this.timedHead = 0;
		}

		return this;
	}

	/** Number of ids still waiting out their reuse delay (useful for diagnostics). */
	public get pendingTimeouts(): number {
		return this.timedIDs.length - this.timedHead;
	}

	public clear(): this {
		this.positiveIDsPool.length = 0;
		this.negativeIDsPool.length = 0;
		this.nextPositiveID = 1;
		this.nextNegativeID = -1;
		this.timedIDs.length = 0;
		this.timedFreeAt.length = 0;
		this.timedHead = 0;

		return this;
	}
}
