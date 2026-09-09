function formatDate() {
    const now = new Date();
    return `\x1b[42m\x1b[30m${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.toLocaleTimeString()}\x1b[0m`;
}
function formatSource(source) {
    return `\x1b[36m${source}\x1b[0m`;
}
export function log(source, ...messages) {
    const date = formatDate();
    const emitter = formatSource(source);
    console.log(`${date} ${emitter} |`, ...messages);
}
export function warn(source, ...messages) {
    const date = formatDate();
    const warn = "\x1b[43m\x1b[30mWARN\x1b[0m";
    const emitter = formatSource(source);
    console.warn(`${date} ${emitter} ${warn} |`, ...messages);
}
export function error(source, ...messages) {
    const date = formatDate();
    const error = "\x1b[41m\x1b[30mERROR\x1b[0m";
    const emitter = formatSource(source);
    console.error(`${date} ${emitter} ${error} |`, ...messages);
}
export function credit(source, ...messages) {
    const date = formatDate();
    const credit = "\x1b[45m\x1b[30mPHOENIX.ENGINE\x1b[0m";
    const emitter = formatSource(source);
    console.log(`${date} ${emitter} ${credit} | Powered by Phoenix.Engine`, ...messages);
}
