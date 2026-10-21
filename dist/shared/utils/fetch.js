import { error } from "./logger";
import { Timeout } from "./timers/timer";
import { wait } from "./timers/wait";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmV0Y2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zaGFyZWQvdXRpbHMvZmV0Y2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUNqQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDekMsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGVBQWUsQ0FBQztBQTBCckMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUVsRCxTQUFTLFdBQVcsQ0FBQyxNQUFjO0lBQ2xDLE9BQU8sTUFBTSxJQUFJLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUlELFNBQVMsWUFBWSxDQUFDLEdBQUcsT0FBK0M7SUFDdkUsTUFBTSxNQUFNLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUU3QixLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLFNBQVM7UUFDVixDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsS0FBSyxVQUFVLFdBQVcsQ0FBSSxPQUFlLEVBQUUsS0FBYSxFQUFFLFFBQVEsR0FBb0IsRUFBRSxFQUFFLFFBQVEsR0FBZ0IsRUFBRTtJQUN2SCxNQUFNLEdBQUcsR0FBRyxHQUFHLE9BQU8sR0FBRyxLQUFLLEdBQUcsUUFBUSxDQUFD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