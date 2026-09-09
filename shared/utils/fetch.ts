import { Timeout } from "./timers/timer.js";

import { wait } from "./timers/wait.js";

import { error } from "./logger.js";
import type { JsonValue } from "./types";

type ResponseError = {
	message: string;
	status: number;
	attempts: number;
	url: string;
};

type Response<T> = {
	success: boolean;
	error?: ResponseError;
	data: T;
};

type RequestSettings = {
	params?: string;
	timeout?: number;
	tries?: number;
	retryDelay?: number;
	fetchOptions?: RequestInit;
};

// 4xx means the request itself is wrong and will fail identically on retry — these three are the
// exceptions, alongside every 5xx (the server may recover).
const RETRIABLE_STATUS = new Set([408, 425, 429]);

function isRetriable(status: number): boolean {
	return status >= 500 || RETRIABLE_STATUS.has(status);
}

/** Merge header sets left to right, later sources winning per key. `Headers` handles the
 *  case-insensitivity, so `content-type` correctly overrides `Content-Type`. */
function mergeHeaders(...sources: (RequestInit["headers"] | undefined)[]): Headers {
	const merged = new Headers();

	for (const source of sources) {
		if (!source) {
			continue;
		}

		new Headers(source).forEach((value, key) => merged.set(key, value));
	}

	return merged;
}

async function HTTPrequest<T>(baseURL: string, route: string, settings: RequestSettings = {}, defaults: RequestInit = {}): Promise<Response<T>> {
	const url = `${baseURL}${route}${settings.params ? `?${settings.params}` : ""}`;

	// Caller-supplied `fetchOptions` override the verb helper's defaults, but headers are merged
	// key by key — adding an `Authorization` header must not drop `Content-Type`.
	const { headers: defaultHeaders, ...defaultInit } = defaults;
	const { headers: overrideHeaders, ...overrideInit } = settings.fetchOptions ?? {};
	const headers = mergeHeaders(defaultHeaders, overrideHeaders);

	let attempts = 0;
	let lastError!: Error;
	let lastStatus = 0;
	let lastBody = "";
	let retryDelay = settings.retryDelay || 1000;

	while (attempts < (settings.tries || 1)) {
		if (attempts > 0) {
			await wait(retryDelay);

			retryDelay *= 2;
		}

		const controller = settings.timeout ? new AbortController() : undefined;

		const timer = settings.timeout
			? new Timeout(() => {
					controller?.abort();
				}, settings.timeout)
			: undefined;

		attempts++;

		try {
			const response = await fetch(url, {
				...defaultInit,
				...overrideInit,
				headers,
				// The timeout controller takes precedence over a caller-supplied signal, otherwise
				// passing `fetchOptions.signal` would silently disable `settings.timeout`.
				signal: controller?.signal ?? overrideInit.signal,
			});

			if (response.ok) {
				const data = await response.json();

				return {
					success: true,
					data: data as T,
				};
			}

			// Preserve the real status + raw body so callers can act on them (e.g. a 403 ban
			// response carries a structured JSON body the client surfaces as a banned screen).
			lastStatus = response.status;
			lastBody = await response.text().catch(() => "");
			lastError = new Error(`HTTP error! status: ${response.status}, message: ${lastBody || "No error details"}`);

			// Branch on the status itself rather than sniffing the message — a ban reason or an id
			// in the body can contain "401" without the response being a 401.
			if (!isRetriable(response.status)) {
				break;
			}
		} catch (err) {
			// Network failure, abort, or an unparseable body — all worth another attempt.
			lastError = err as Error;
		} finally {
			timer?.clear();
		}
	}

	// Prefer the server's raw body (e.g. the ban JSON), then the wrapped error message.
	const message = lastBody || lastError?.message || `Request failed (HTTP ${lastStatus || "error"})`;

	error("Client", `${url} failed after ${attempts} attempts | ${message}`);

	return {
		success: false,
		error: {
			message,
			status: lastStatus,
			attempts,
			url,
		},
		data: undefined as T,
	};
}

export async function post<T = any>(baseURL: string = "./", route: string, body: JsonValue, settings?: RequestSettings): Promise<Response<T>> {
	return HTTPrequest<T>(baseURL, route, settings, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

export async function get<T = any>(baseURL: string = "./", route: string, settings?: RequestSettings): Promise<Response<T>> {
	return HTTPrequest<T>(baseURL, route, settings, {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
	});
}

export async function put<T = any>(baseURL: string = "./", route: string, body: JsonValue, settings?: RequestSettings): Promise<Response<T>> {
	return HTTPrequest<T>(baseURL, route, settings, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

export async function del<T = any>(baseURL: string = "./", route: string, body?: JsonValue, settings?: RequestSettings): Promise<Response<T>> {
	return HTTPrequest<T>(baseURL, route, settings, {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
}
