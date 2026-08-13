const ticks = new Map<number, () => void>();

const channel = new MessageChannel();
channel.port1.start();

let count = 0;

channel.port1.addEventListener("message", function (event: MessageEvent) {
	const action = ticks.get(event.data);

	if (action) {
		action(); // Execute the callback

		ticks.delete(event.data);
	}
});

export function nextTick(callback: () => void) {
	const id = ++count % Number.MAX_SAFE_INTEGER; // Ensure the ID wraps around safely

	ticks.set(id, callback);

	channel.port2.postMessage(id); // Send a message to the other port
}

// This is a workaround for precise timers
