export class EventEmitter<Events extends Record<string, any[]>> {
	private readonly listeners = new Map<keyof Events, Set<(...args: any[]) => void>>();

	/**
	 * Subscribe to an event.
	 * @param event The event name to subscribe to.
	 * @param callback The callback function to invoke when the event is emitted.
	 *
	 * @returns Unsubscribe function for effortless cleanup.
	 */
	public on<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}

		this.listeners.get(event)!.add(callback);

		// Return cleanup function to prevent memory leaks!
		return () => this.off(event, callback);
	}

	/**
	 * Unsubscribe from an event.
	 * @param event The event name to unsubscribe from.
	 * @param callback The callback function to remove.
	 */
	public off<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void): void {
		this.listeners.get(event)?.delete(callback);
	}

	/**
	 * Emit an event, invoking all subscribed callbacks with the provided arguments.
	 * @param event The event name to emit.
	 * @param args The arguments to pass to the subscribed callbacks.
	 */
	protected emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
		for (const callback of this.listeners.get(event) ?? []) {
			callback(...args);
		}
	}
}
