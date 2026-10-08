export type DeepImmutable<T> = {
	readonly [K in keyof T]: T[K] extends object ? DeepImmutable<T[K]> : T[K];
};

// JSON
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = {
	[key: string]: JsonValue;
};
