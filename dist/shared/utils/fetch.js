import { Timeout } from "./timers/timer.js";
import { wait } from "./timers/wait.js";
import { error } from "./logger.js";
const RETRIABLE_STATUS = new Set([408, 425, 429]);
function isRetriable(status) {
    return status >= 500 || RETRIABLE_STATUS.has(status);
}
function mergeHeaders(...sources) {
    const merged = new Headers();
    for (const source of sources) {
        if (!source) {
            continue;
        }
        new Headers(source).forEach((value, key) => merged.set(key, value));
    }
    return merged;
}
async function HTTPrequest(baseURL, route, settings = {}, defaults = {}) {
    const url = `${baseURL}${route}${settings.params ? `?${settings.params}` : ""}`;
    const { headers: defaultHeaders, ...defaultInit } = defaults;
    const { headers: overrideHeaders, ...overrideInit } = settings.fetchOptions ?? {};
    const headers = mergeHeaders(defaultHeaders, overrideHeaders);
    let attempts = 0;
    let lastError;
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
                signal: controller?.signal ?? overrideInit.signal,
            });
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    data: data,
                };
            }
            lastStatus = response.status;
            lastBody = await response.text().catch(() => "");
            lastError = new Error(`HTTP error! status: ${response.status}, message: ${lastBody || "No error details"}`);
            if (!isRetriable(response.status)) {
                break;
            }
        }
        catch (err) {
            lastError = err;
        }
        finally {
            timer?.clear();
        }
    }
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
        data: undefined,
    };
}
export async function post(baseURL = "./", route, body, settings) {
    return HTTPrequest(baseURL, route, settings, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}
export async function get(baseURL = "./", route, settings) {
    return HTTPrequest(baseURL, route, settings, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });
}
export async function put(baseURL = "./", route, body, settings) {
    return HTTPrequest(baseURL, route, settings, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}
export async function del(baseURL = "./", route, body, settings) {
    return HTTPrequest(baseURL, route, settings, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}
