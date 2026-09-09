import { error, warn } from "../../../shared/utils/logger";

/**
 * Install the process-wide termination handlers.
 *
 * @param onStop — optional last-chance hook run once, synchronously, before the process
 *   goes away (crash, signal or normal exit). Must be sync: anything async is cut off by
 *   `process.exit`. Used by the core thread to persist unbanked coin deposits to the
 *   durable queue so they survive a restart. Throwing here never blocks the exit.
 */
export function setExitListeners(source: string, onStop?: () => void): void {
	let stopped = false;

	const stop = (): void => {
		if (stopped || !onStop) return;
		stopped = true;

		try {
			onStop();
		} catch (err) {
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

function exit(code: number = 0, stop?: () => void): void {
	stop?.();

	// Force logger to flush logs before exiting
	process.stderr.write("", () => {
		process.exit(code);
	});
}
