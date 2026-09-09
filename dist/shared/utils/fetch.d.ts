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
export declare function post<T = any>(baseURL: string | undefined, route: string, body: JsonValue, settings?: RequestSettings): Promise<Response<T>>;
export declare function get<T = any>(baseURL: string | undefined, route: string, settings?: RequestSettings): Promise<Response<T>>;
export declare function put<T = any>(baseURL: string | undefined, route: string, body: JsonValue, settings?: RequestSettings): Promise<Response<T>>;
export declare function del<T = any>(baseURL: string | undefined, route: string, body?: JsonValue, settings?: RequestSettings): Promise<Response<T>>;
export {};
