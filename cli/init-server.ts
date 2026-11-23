import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PORT, type DeployConfig, loadServers, SERVERS_PATH, SSH_OPTIONS, sshPath } from "./config";

/** What preparing one host takes: who to log in as, with which key, and every game port its instances listen on. */
export type ServerPlan = { host: string; user: string; key: string; ports: number[] };

/** Every host in the config, each once, with the ports of all its instances across every target. */
export function planServers(config: DeployConfig, dir: string): ServerPlan[] {
	const plans = new Map<string, ServerPlan>();

	for (const target of Object.values(config.targets ?? {})) {
		for (const server of target.servers) {
			const plan = plans.get(server.host) ?? { host: server.host, user: server.user, key: path.resolve(dir, server.key ?? config.key), ports: [] };

			for (const instance of server.instances) {
				const port = instance.port ?? DEFAULT_PORT;

				if (!plan.ports.includes(port)) {
					plan.ports.push(port);
				}
			}

			plans.set(server.host, plan);
		}
	}

	return [...plans.values()];
}

/** The game's name as server_init.sh takes it for its files and firewall rules: lowercase letters, digits and dashes. */
export function appName(packageName: string | undefined): string {
	const name = (packageName ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return name === "" ? "game" : name;
}

function run(command: string, args: string[]): Promise<number> {
	return Bun.spawn([command, ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" }).exited;
}

/**
 * Prepare a fresh Ubuntu server listed in servers.json for deploys: copy server_init.sh to it over SSH and run it
 * there with sudo (Docker, the deploy user in the docker group, kernel limits, the firewall open on its game ports).
 * Safe to run again. Without a host, lists the hosts it knows.
 */
export async function initServer(host: string | undefined): Promise<void> {
	const { config, dir } = loadServers();
	const plans = planServers(config, dir);
	const plan = plans.find((candidate) => candidate.host === host);

	if (plan === undefined) {
		console.log(host === undefined ? "Usage: phoenix init-server <host>" : `${host} is not in ${SERVERS_PATH}.`);
		console.log(plans.length === 0 ? `${SERVERS_PATH} lists no servers.` : `Hosts in ${SERVERS_PATH}: ${plans.map(({ host, ports }) => `${host} (ports ${ports.join(" ")})`).join(", ")}`);

		process.exitCode = 1;

		return;
	}

	if (!fs.existsSync(plan.key)) {
		throw new Error(`SSH key not found at ${plan.key}`);
	}

	const name = appName(JSON.parse(fs.readFileSync("package.json", "utf-8")).name);
	const remote = `${plan.user}@${plan.host}`;
	const script = `/tmp/${name}-server-init.sh`;
	const ssh = ["-i", sshPath(plan.key), ...SSH_OPTIONS];

	console.log(`Preparing ${remote} for ${name}, game ports ${plan.ports.join(" ")}...`);

	if ((await run("scp", [...ssh, sshPath(path.join(import.meta.dirname, "server_init.sh")), `${remote}:${script}`])) !== 0) {
		throw new Error(`Could not copy server_init.sh to ${remote}`);
	}

	const status = await run("ssh", [...ssh, "-t", remote, `sudo APP_NAME=${name} APP_PORTS='${plan.ports.join(" ")}' bash ${script} ${plan.user}; status=$?; rm -f ${script}; exit $status`]);

	if (status !== 0) {
		throw new Error(`server_init.sh failed on ${remote} (exit ${status})`);
	}

	console.log(`✅ ${remote} is ready: deploy to it with phoenix deploy.`);
}
