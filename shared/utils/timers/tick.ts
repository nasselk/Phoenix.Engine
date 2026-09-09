const ticks = new Map<number, () => void>();

const channel = new MessageChannel();

let count = 0;

// `onmessage` rather than addEventListener: it starts the port implicitly and is typed the same
// way under the DOM and Bun lib sets, where the listener overloads disagree.
channel.port1.onmessage = (event): void => {
	const action = ticks.get(event.data);

	if (action) {
		action(); // Execute the callback

		ticks.delete(event.data);
	}
};

export function nextTick(callback: () => void) {
	const id = ++count % Number.MAX_SAFE_INTEGER; // Ensure the ID wraps around safely

	ticks.set(id, callback);

	channel.port2.postMessage(id); // Send a message to the other port
}

// This is a workaround for precise timers
