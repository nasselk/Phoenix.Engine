import countries from "./countries.json";
type CountryCode = keyof typeof countries;
export type Server = {
    id: string;
    name: string;
    url: string;
    countryCode?: CountryCode;
};
export type Servers = {
    [mode: string]: {
        [region: string]: Server[];
    };
};
export declare function listServers(servers: Servers): Server[];
export declare function getCountryCode(cloudflareHosted?: boolean): Promise<CountryCode | undefined>;
export declare function closestServer(servers: readonly Server[], country?: CountryCode): Server | undefined;
export declare function findRoomServer(servers: readonly Server[], code: string): Promise<Server | undefined>;
export {};
