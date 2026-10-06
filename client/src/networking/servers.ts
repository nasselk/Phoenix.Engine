import { get, RoomOccupancy } from "../../../shared";
import countries from "./countries.json";

type CountryCode = keyof typeof countries;

export type Server = {
	id: string;
	name: string;
	url: string;
	countryCode?: CountryCode;
};

/** Every server, by game mode and then region, as in shared/servers.json. */
export type Servers = {
	[mode: string]: {
		[region: string]: Server[];
	};
};

/** Every server of every mode and region, in one list. */
export function listServers(servers: Servers): Server[] {
	return Object.values(servers).flatMap((regions) => Object.values(regions).flat());
}

/**
 * The player's country, from Cloudflare's trace: the page's own when it is served by Cloudflare,
 * cloudflare.com's otherwise. Undefined when it cannot be told.
 */
export async function getCountryCode(cloudflareHosted: boolean = false): Promise<CountryCode | undefined> {
	try {
		const response = await fetch(`${cloudflareHosted ? "" : "https://www.cloudflare.com"}/cdn-cgi/trace`);
		const code = /^loc=(\w+)$/m.exec(await response.text())?.[1];

		return code !== undefined && code in countries ? (code as CountryCode) : undefined;
	} catch {
		return undefined;
	}
}

/** Great-circle distance between two points, in kilometres. */
function distance([lat1, lon1]: readonly number[], [lat2, lon2]: readonly number[]): number {
	const radians = Math.PI / 180;
	const a = 0.5 - Math.cos((lat2! - lat1!) * radians) / 2 + (Math.cos(lat1! * radians) * Math.cos(lat2! * radians) * (1 - Math.cos((lon2! - lon1!) * radians))) / 2;

	return 12742 * Math.asin(Math.sqrt(a));
}

/** The server whose country is nearest the player's; the first one when either is unknown. */
export function closestServer(servers: readonly Server[], country?: CountryCode): Server | undefined {
	if (country === undefined) {
		return servers[0];
	}

	let closest = servers[0];
	let shortest = Infinity;

	for (const server of servers) {
		if (server.countryCode !== undefined) {
			const away = distance(countries[country], countries[server.countryCode]);

			if (away < shortest) {
				closest = server;
				shortest = away;
			}
		}
	}

	return closest;
}

/**
 * The server with a room under that invite code, asking every server at once: the first to say it has
 * it is the answer, without waiting for the rest. Undefined once every server said it has not.
 */
export async function findRoomServer(servers: readonly Server[], code: string): Promise<Server | undefined> {
	const asks = servers.map(async (server) => {
		const answer = await get<RoomOccupancy>(server.url, `/rooms/${encodeURIComponent(code)}`, { timeout: 3000, tries: 1 });

		if (!answer.success) {
			throw new Error(`${server.name} has no room ${code}`);
		}

		return server;
	});

	try {
		return await Promise.any(asks);
	} catch {
		return undefined;
	}
}
