import { get } from "../../../shared";
import countries from "./countries.json";
export function listServers(servers) {
    return Object.values(servers).flatMap((regions) => Object.values(regions).flat());
}
export async function getCountryCode(cloudflareHosted = false) {
    try {
        const response = await fetch(`${cloudflareHosted ? "" : "https://www.cloudflare.com"}/cdn-cgi/trace`);
        const code = /^loc=(\w+)$/m.exec(await response.text())?.[1];
        return code !== undefined && code in countries ? code : undefined;
    }
    catch {
        return undefined;
    }
}
function distance([lat1, lon1], [lat2, lon2]) {
    const radians = Math.PI / 180;
    const a = 0.5 - Math.cos((lat2 - lat1) * radians) / 2 + (Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * (1 - Math.cos((lon2 - lon1) * radians))) / 2;
    return 12742 * Math.asin(Math.sqrt(a));
}
export function closestServer(servers, country) {
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
export async function findRoomServer(servers, code) {
    const asks = servers.map(async (server) => {
        const answer = await get(server.url, `/rooms/${encodeURIComponent(code)}`, { timeout: 3000, tries: 1 });
        if (!answer.success) {
            throw new Error(`${server.name} has no room ${code}`);
        }
        return server;
    });
    try {
        return await Promise.any(asks);
    }
    catch {
        return undefined;
    }
}
