import fs from "node:fs";
import path from "node:path";

export type Environment = Record<string, string | number>;
export type EnvironmentSource = string | Environment;

export type SSL = { key: string; cert: string };

export type Instance = {
	name: string;
	port?: number;
	version?: string;
	env?: EnvironmentSource;
	ssl?: SSL;
	cpuShares?: number;
	memory?: string;
};

export type Server = {
	name?: string;
	user: string;
	host: string;
	key?: string;
	version?: string;
	env?: EnvironmentSource;
	ssl?: SSL;
	instances: Instance[];
};

export type Target = { env?: EnvironmentSource; servers: Server[] };

export type DeployConfig = {
	key: string;
	env?: EnvironmentSource;
	ssl?: SSL;
	targets?: Record<string, Target>;
};

/** Where a game keeps its servers, from its root: paths inside are relative to this file's folder. */
export const SERVERS_PATH = "scripts/servers.json";

/** The port the game server listens on without a PORT, as in the template's server/src/config.ts. */
export const DEFAULT_PORT = 443;

export const SSH_OPTIONS = ["-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", "-o", "PasswordAuthentication=no", "-o", "BatchMode=yes", "-o", "ServerAliveInterval=5", "-o", "ServerAliveCountMax=3"];

/** The game's servers.json, read from the folder the command runs in, and the folder its paths are relative to. */
export function loadServers(root: string = process.cwd()): { config: DeployConfig; dir: string } {
	const file = path.resolve(root, SERVERS_PATH);

	if (!fs.existsSync(file)) {
		throw new Error(`No ${SERVERS_PATH} in ${root}: run phoenix from the game's root folder.`);
	}

	return { config: JSON.parse(fs.readFileSync(file, "utf-8")), dir: path.dirname(file) };
}

/** A path ssh and scp accept on every platform. */
export function sshPath(filePath: string): string {
	return filePath.replace(/\\/g, "/");
}
