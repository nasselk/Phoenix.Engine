const ticks = new Map();
const channel = new MessageChannel();
let count = 0;
channel.port1.onmessage = (event) => {
    const action = ticks.get(event.data);
    if (action) {
        action();
        ticks.delete(event.data);
    }
};
export function nextTick(callback) {
    const id = ++count % Number.MAX_SAFE_INTEGER;
    ticks.set(id, callback);
    channel.port2.postMessage(id);
}
