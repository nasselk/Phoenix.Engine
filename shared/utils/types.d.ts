export type Immutable<T> = {
	readonly [K in keyof T]: T[K] extends object ? Immutable<T[K]> : T[K];
};

export type DeepImmutable<T> = {
	readonly [K in keyof T]: T[K] extends object ? DeepImmutable<T[K]> : T[K];
};

export type Mutable<T> = {
	-readonly [K in keyof T]: T[K];
};

export type DeepMutable<T> = {
	-readonly [K in keyof T]: T[K] extends object ? DeepMutable<T[K]> : T[K];
};

// JSON utilities
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };

// Optional/Required utilities
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Nullability utilities
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// Function utilities
export type Constructor<T> = (new (...args: any) => T) | (abstract new (...args: any) => T);
export type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (...args: any) => Promise<infer R> ? R : never;

// Array utilities
export type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
export type NonEmptyArray<T> = [T, ...T[]];
export type Tuple<T, N extends number> = N extends N ? (number extends N ? T[] : _TupleOf<T, N, []>) : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N ? R : _TupleOf<T, N, [...R, T]>;

// Conditional utilities
export type If<C extends boolean, T, F> = C extends true ? T : F;
export type IsEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
export type IsAny<T> = 0 extends 1 & T ? true : false;
export type IsNever<T> = [T] extends [never] ? true : false;
export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// String utilities
export type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];
export type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}` ? `${P1}${Uppercase<P2>}${CamelCase<P3>}` : S;
