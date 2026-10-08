import type { ProtocolChannel } from "./protocol";

/**
 * The handler for each inbound event, indexed by wire code so a frame finds its handler without
 * hashing a name. One handler per event, since a raw reader can only be read once.
 */
export class MessageHandlers<Handler extends (...args: any[]) => void> {
	private readonly handlers: Array<Handler | undefined> = [];

	public constructor(private readonly channel: ProtocolChannel) {}

	/** Register the handler for an event. Throws if it already has one; returns a function that removes it. */
	public add(event: string, handler: Handler): () => void {
		const code = this.channel.code(event);

		if (this.handlers[code] !== undefined) {
			throw new Error(`"${event}" already has a handler; remove it with the function its onMessage returned first`);
		}

		this.handlers[code] = handler;

		return () => {
			if (this.handlers[code] === handler) {
				this.handlers[code] = undefined;
			}
		};
	}

	public get(code: number): Handler | undefined {
		return this.handlers[code];
	}
}
