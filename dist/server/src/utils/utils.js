import { error, warn } from "../../../shared/utils/logger";
export function setExitListeners(source, onStop) {
    let stopped = false;
    const stop = () => {
        if (stopped || !onStop)
            return;
        stopped = true;
        try {
            onStop();
        }
        catch (err) {
            error(source, `Stop handler failed: ${err instanceof Error ? err.stack : String(err)}`);
        }
    };
    process.on("uncaughtException", (err) => {
        error(source, `${err.stack}`);
        exit(1, stop);
    });
    process.on("unhandledRejection", (err) => {
        error(source, `${err}`);
        exit(1, stop);
    });
    process.on("beforeExit", (code) => {
        warn(source, `Before exit with code=${code}`);
        exit(0, stop);
    });
    process.on("exit", (code) => {
        warn(source, `Exiting with code=${code}`);
        exit(code, stop);
    });
    process.on("SIGTERM", () => {
        warn(source, "Exiting: SIGTERM");
        exit(0, stop);
    });
    process.on("SIGINT", () => {
        warn(source, "Exiting: SIGINT");
        exit(0, stop);
    });
}
function exit(code = 0, stop) {
    stop?.();
    process.stderr.write("", () => {
        process.exit(code);
    });
}
