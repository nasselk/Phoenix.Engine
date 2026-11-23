import { type SpawnOptions, spawn } from "node:child_process";
import fs from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { DEFAULT_PORT, type DeployConfig, type Environment, type EnvironmentSource, type Instance, loadServers, SERVERS_PATH, type Server, SSH_OPTIONS, sshPath, type Target } from "./config";
import { add, commit, mirror, push, readGit, runGit, tag, tagExists } from "./git";

type Credentials = { ghUser: string; ghToken: string };

type CommandResult = { status: number | null; stdout: string; stderr: string };

type DeployResult = { instance: string; server: string; status: "success" | "failed"; error?: string };

type WorkflowRun = { name: string; status: string; conclusion: string | null; html_url: string };

const SHARED_CONFIG_PATH = "./shared/config.json";
const PACKAGE_PATH = "./package.json";

const GH_CREDS_PATH = path.resolve(".keys/github.json");

let config: DeployConfig;
let CONFIG_DIR: string;

const WORKFLOW_NAME = "Push docker image";
const BUILD_POLL_INTERVAL_MS = 10_000;
const BUILD_DETECT_TIMEOUT_MS = 90_000;
const BUILD_TOTAL_TIMEOUT_MS = 30 * 60 * 1000;

/** `v1.2.3` for production, `beta-v1.2.3` for any other deploy branch. */
function tagName(branch: string, version: string): string {
	return branch === "production" ? `v${version}` : `${branch}-v${version}`;
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** One argument for the remote shell, which expands nothing inside single quotes. */
function quote(value: string | number): string {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

// --- VERSION BUMP ---

function loadGhCreds(): Credentials | null {
	if (!fs.existsSync(GH_CREDS_PATH)) {
		console.warn(`⚠️  GitHub credentials file not found at ${GH_CREDS_PATH} — falling back to prompt.`);
		return null;
	}
	try {
		const { user, token } = JSON.parse(fs.readFileSync(GH_CREDS_PATH, "utf-8"));
		if (!user || !token) {
			console.warn(`⚠️  ${GH_CREDS_PATH} is missing "user" or "token" — falling back to prompt.`);
			return null;
		}
		return { ghUser: user, ghToken: token };
	} catch (err) {
		console.warn(`⚠️  Failed to parse ${GH_CREDS_PATH} (${messageOf(err)}) — falling back to prompt.`);
		return null;
	}
}

function nextVersion(version: string): string {
	const parts = version.split(".");
	const last = Number(parts.at(-1));

	if (!Number.isInteger(last)) return "";

	parts[parts.length - 1] = String(last + 1);

	return parts.join(".");
}

async function getInputs(): Promise<{ version: string; branch: string } & Credentials> {
	const rl = createInterface({ input, output });

	const current: string = JSON.parse(await readFile(SHARED_CONFIG_PATH, "utf-8")).gameVersion;
	const suggested = nextVersion(current);

	const version = (await rl.question(`Version to deploy (current ${current}) [${suggested}]: `)).trim() || suggested;
	if (!version || version === current) {
		console.error(`The version must change: every deploy is a new gameVersion.`);
		rl.close();
		process.exit(1);
	}

	const targets = Object.keys(config.targets ?? {});
	const branch = (await rl.question(`Branch to deploy to (${targets.join(" | ")} | any other) [production]: `)).trim() || "production";
	if (branch === "main") {
		console.error(`Deploying to main would push main onto itself: pick a deploy branch.`);
		rl.close();
		process.exit(1);
	}

	let creds = loadGhCreds();

	if (!creds) {
		console.log("\n--- GitHub Container Registry Authentication ---");
		const ghUser = (await rl.question("GitHub Username: ")).trim();
		const ghToken = (await rl.question("Personal Access Token (PAT): ")).trim();
		creds = { ghUser, ghToken };
	} else {
		console.log(`\n🔑 Using GitHub credentials from ${GH_CREDS_PATH} (user: ${creds.ghUser})`);
	}

	rl.close();
	return { version, branch, ...creds };
}

async function updateJson(filePath: string, key: string, version: string): Promise<void> {
	const cfg = JSON.parse(await readFile(filePath, "utf-8"));
	cfg[key] = version;
	await writeFile(filePath, JSON.stringify(cfg, null, "\t"), "utf-8");
}

// --- BUILD WAIT ---

async function ghFetch<T>(url: string, token: string): Promise<T> {
	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});
	if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
	return res.json() as Promise<T>;
}

async function waitForBuild(repo: string, branch: string, sha: string, token: string): Promise<void> {
	const url = `https://api.github.com/repos/${repo}/actions/runs?head_sha=${sha}&branch=${encodeURIComponent(branch)}&event=push`;
	const start = Date.now();
	let detected = false;

	console.log(`\n⏳ Waiting for Docker build (sha ${sha.slice(0, 7)})...`);

	while (true) {
		const elapsed = Date.now() - start;
		if (elapsed > BUILD_TOTAL_TIMEOUT_MS) {
			throw new Error(`Build wait timed out after ${Math.round(elapsed / 60000)} min`);
		}

		const { workflow_runs } = await ghFetch<{ workflow_runs: WorkflowRun[] }>(url, token);
		const run = workflow_runs.find((r) => r.name === WORKFLOW_NAME);

		if (!run) {
			if (!detected && elapsed > BUILD_DETECT_TIMEOUT_MS) {
				throw new Error(`No "${WORKFLOW_NAME}" run started for ${branch}. Add the branch to .github/workflows/deploy.yaml, or give it no servers in ${SERVERS_PATH}.`);
			}
			console.log("  → Waiting for workflow to start...");
		} else {
			detected = true;
			if (run.status === "completed") {
				if (run.conclusion !== "success") {
					throw new Error(`Build ${run.conclusion}: ${run.html_url}`);
				}
				console.log(`✅ Build succeeded: ${run.html_url}`);
				return;
			}
			console.log(`  → Build ${run.status}...`);
		}

		await new Promise((r) => setTimeout(r, BUILD_POLL_INTERVAL_MS));
	}
}

// --- SERVER DEPLOY ---

function runCommand(cmd: string, args: string[], options: SpawnOptions & { input?: string } = {}): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		const { input: stdinText, ...spawnOptions } = options;
		const child = spawn(cmd, args, { ...spawnOptions, shell: false, stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";

		child.stdin.end(stdinText ?? "");

		child.stdout.on("data", (data: Buffer) => (stdout += data.toString()));
		child.stderr.on("data", (data: Buffer) => (stderr += data.toString()));

		const timeout = setTimeout(
			() => {
				child.kill("SIGKILL");
				reject(new Error(`Command timeout after 5 minutes: ${cmd} ${args.join(" ")}`));
			},
			5 * 60 * 1000,
		);

		child.on("close", (status) => {
			clearTimeout(timeout);
			resolve({ status, stdout, stderr });
		});

		child.on("error", (err) => {
			clearTimeout(timeout);
			reject(err);
		});
	});
}

function getEnvironment(envInput?: EnvironmentSource): Environment {
	if (!envInput) return {};
	if (typeof envInput !== "string") return envInput;

	const filePath = path.resolve(CONFIG_DIR, envInput);
	if (!fs.existsSync(filePath)) {
		console.warn(`Warning: Env file not found at ${filePath}`);
		return {};
	}

	const content = fs.readFileSync(filePath, "utf-8");
	const envObj: Environment = {
		NODE_ENV: "production",
	};

	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
		const eq = trimmed.indexOf("=");
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();

		if (value[0] === '"' || value[0] === "'") {
			// Quoted value: take everything up to the matching closing quote,
			// dropping any inline comment that follows it.
			const quote = value[0];
			const end = value.indexOf(quote, 1);
			value = end === -1 ? value.slice(1) : value.slice(1, end);
		} else {
			// Unquoted value: a `#` preceded by whitespace begins an inline comment
			// (e.g. `SANDBOX=true # ...` must yield "true", not "true # ...").
			const comment = value.search(/\s#/);
			if (comment !== -1) value = value.slice(0, comment);
			value = value.trim();
		}

		envObj[key] = value;
	}

	return envObj;
}

async function syncSSL(instance: Instance, server: Server, sshKey: string): Promise<string> {
	const ssl = instance.ssl || server.ssl || config.ssl;
	if (!ssl?.key || !ssl?.cert) return "";

	const localKey = path.resolve(CONFIG_DIR, ssl.key);
	const localCert = path.resolve(CONFIG_DIR, ssl.cert);
	const remoteDir = `/home/${server.user}/.ssl_${instance.name}`;

	if (!fs.existsSync(localKey)) {
		throw new Error(`[${instance.name}] SSL key not found at: ${localKey}`);
	}
	if (!fs.existsSync(localCert)) {
		throw new Error(`[${instance.name}] SSL cert not found at: ${localCert}`);
	}

	const remoteTarget = `${server.user}@${server.host}`;
	const sshOpts = ["-i", sshPath(sshKey), ...SSH_OPTIONS];

	const mkdirResult = await runCommand("ssh", [...sshOpts, remoteTarget, `mkdir -p ${quote(remoteDir)}`]);
	if (mkdirResult.status !== 0) {
		throw new Error(`[${instance.name}] Failed to create remote dir ${remoteDir}: ${mkdirResult.stderr}`);
	}

	const keyResult = await runCommand("scp", [...sshOpts, localKey, `${remoteTarget}:${remoteDir}/key.pem`]);
	if (keyResult.status !== 0) {
		throw new Error(`[${instance.name}] Failed to SCP key to ${remoteTarget}: ${keyResult.stderr}`);
	}

	const certResult = await runCommand("scp", [...sshOpts, localCert, `${remoteTarget}:${remoteDir}/cert.pem`]);
	if (certResult.status !== 0) {
		throw new Error(`[${instance.name}] Failed to SCP cert to ${remoteTarget}: ${certResult.stderr}`);
	}

	return `--volume ${quote(`${remoteDir}:/app/server/ssl:ro`)}`;
}

// The container shares the host's network, so Docker opens nothing: the host's own firewall has to let the port in.
// ufw or firewalld, whichever is active; a host with neither lets everything in already. Allowing a port twice is a no-op.
function getFirewallCommand(port: number): string {
	const sudo = `$([ "$(id -u)" -eq 0 ] || echo sudo -n)`;

	return `if command -v ufw >/dev/null 2>&1 && ${sudo} ufw status | grep -q 'Status: active'; then ${sudo} ufw allow ${port}/tcp; elif command -v firewall-cmd >/dev/null 2>&1 && ${sudo} firewall-cmd --state >/dev/null 2>&1; then ${sudo} firewall-cmd --permanent --add-port=${port}/tcp && ${sudo} firewall-cmd --reload; fi`;
}

function getDockerCommand(instance: Instance, fullImage: string, envObj: Environment, sslFlag: string, ghUser: string, source: string): string {
	const envFlags = Object.entries(envObj)
		.map(([k, v]) => {
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
				throw new Error(`Invalid environment variable name: ${JSON.stringify(k)}`);
			}

			return `--env ${quote(`${k}=${v}`)}`;
		})
		.join(" ");

	const cpuShares = `--cpu-shares=${quote(instance.cpuShares || 1024)}`;
	const ulimitFiles = `--ulimit nofile=1000000:1000000`;
	const networkMode = `--network host`;
	const dataVolume = `--volume ${quote(`${instance.name}-data:/app/server/data`)}`;

	// Cap RAM per lobby so a runaway can only kill its own container instead of
	// exhausting host memory and taking the co-located lobbies with it.
	// memory-swap is set equal to memory, which disables swap: a realtime game
	// loop that starts swapping would stall far worse than it would by dying.
	const memory = instance.memory || "2g";
	const memoryLimits = `--memory=${quote(memory)} --memory-swap=${quote(memory)}`;

	return [
		`DOCKER_CONFIG="$(mktemp -d)"`,
		`export DOCKER_CONFIG`,
		`trap 'rm -rf "$DOCKER_CONFIG"' EXIT`,
		`trap 'exit 1' HUP INT TERM`,
		`(${getFirewallCommand(Number(envObj.PORT ?? DEFAULT_PORT))})`,
		`docker login ghcr.io -u ${quote(ghUser)} --password-stdin`,
		`docker pull ${quote(fullImage)}`,
		`(docker rm -f ${quote(instance.name)} || true)`,
		`docker run -d \
            --name ${quote(instance.name)} \
            ${networkMode} \
            ${cpuShares} \
            ${memoryLimits} \
            ${ulimitFiles} \
            ${envFlags} \
            ${sslFlag} \
            ${dataVolume} \
            --restart always \
            ${quote(fullImage)}`,
		`docker image prune -af --filter ${quote(`label=org.opencontainers.image.source=${source}`)}`,
	].join(" && ");
}

function runRemote(server: Server, sshKey: string, command: string, stdinText?: string): Promise<CommandResult> {
	return runCommand("ssh", ["-i", sshPath(sshKey), ...SSH_OPTIONS, `${server.user}@${server.host}`, command], { input: stdinText });
}

async function deployInstance(instance: Instance, server: Server, fullImage: string, finalEnv: Environment, { ghUser, ghToken }: Credentials, sshKey: string, source: string): Promise<DeployResult> {
	console.log(`Deploying [${instance.name}] on ${server.host} | Image: ${fullImage}`);

	try {
		let sslFlag: string;

		try {
			console.log(`  → Syncing SSL certificates...`);
			sslFlag = await syncSSL(instance, server, sshKey);
		} catch (sslError) {
			throw new Error(`SSL sync failed: ${messageOf(sslError)}`);
		}

		const dockerCmd = getDockerCommand(instance, fullImage, finalEnv, sslFlag, ghUser, source);
		console.log(`  → Deploying container...`);
		const result = await runRemote(server, sshKey, dockerCmd, `${ghToken}\n`);

		if (result.status === 0) {
			console.log(`✅ Success: ${instance.name} is running.`);
			return { instance: instance.name, server: server.host, status: "success" };
		}

		throw new Error(`Docker command failed: ${result.stderr || result.stdout || "Unknown error"}`);
	} catch (error) {
		console.error(`❌ Error deploying ${instance.name} on ${server.host}: ${messageOf(error)}`);
		return { instance: instance.name, server: server.host, status: "failed", error: messageOf(error) };
	}
}

async function deployToServers(target: Target, image: string, tag: string, credentials: Credentials, source: string): Promise<void> {
	const rootEnv = getEnvironment(target.env ?? config.env);

	const allPromises: Promise<DeployResult>[] = [];

	for (const server of target.servers) {
		console.log(`\nProcessing Server: ${server.name || server.host}`);
		const sshKey = path.resolve(CONFIG_DIR, server.key || config.key);
		const serverEnv = { ...rootEnv, ...getEnvironment(server.env) };

		for (const instance of server.instances) {
			const fullImage = `${image}:${instance.version || server.version || tag}`;
			const finalEnv = { ...serverEnv, ...getEnvironment(instance.env), ...(instance.port ? { PORT: instance.port } : {}) };

			allPromises.push(deployInstance(instance, server, fullImage, finalEnv, credentials, sshKey, source));
		}
	}

	console.log(`\n⏳ Running ${allPromises.length} deployments in parallel...`);
	const results = await Promise.allSettled(allPromises);

	const successful = results.filter((r) => r.status === "fulfilled" && r.value.status === "success").length;
	const failed = results.length - successful;

	console.log(`\n📊 Deployment Summary:`);
	console.log(`   ✅ Successful: ${successful}`);
	console.log(`   ❌ Failed: ${failed}`);

	if (failed > 0) {
		process.exit(1);
	}
}

// --- MAIN ---

async function readRepository(): Promise<string> {
	const url = await readGit("remote", "get-url", "origin");
	const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);

	if (!match?.[1]) {
		throw new Error(`origin is not a GitHub repository: ${url}`);
	}

	return match[1];
}

/**
 * Ship `main` as it is on GitHub: bump the version, tag it, move the deploy branch to it (Cloudflare builds the
 * client from there, GitHub Actions the server image), then restart that branch's servers on the new image.
 */
export async function deploy(): Promise<void> {
	({ config, dir: CONFIG_DIR } = loadServers());

	const { version, branch, ...credentials } = await getInputs();
	const target = config.targets?.[branch] ?? { servers: [] };
	const repo = await readRepository();
	const image = `ghcr.io/${repo.toLowerCase()}-server`;

	await runGit("switch", "main").catch(() => {
		console.error("Failed to switch to main branch");
		process.exit(1);
	});

	if ((await readGit("status", "--porcelain")) !== "") {
		console.error("The working tree has uncommitted changes. Commit or stash them first: a deploy ships main as it is on GitHub.");
		process.exit(1);
	}

	await runGit("pull", "--ff-only");

	const release = tagName(branch, version);

	if (await tagExists(release)) {
		console.error(`The tag ${release} already exists: pick another version.`);
		process.exit(1);
	}

	await Promise.all([updateJson(SHARED_CONFIG_PATH, "gameVersion", version), updateJson(PACKAGE_PATH, "version", version)]);

	console.log(`\nUpdated version to ${version}`);

	await add(SHARED_CONFIG_PATH, PACKAGE_PATH);

	await commit(`chore: bump version to ${version}`);
	await push();
	await tag(release, `Deploy ${version} to ${branch}`);
	await mirror("main", branch);

	const sha = await readGit("rev-parse", "HEAD");

	console.log(`\nVersion ${version} pushed to main, tagged ${release}, and ${branch} moved to it (${sha.slice(0, 7)}). Cloudflare builds the client from ${branch}.`);

	if (target.servers.length === 0) {
		console.log(`No servers for ${branch} in ${SERVERS_PATH}: nothing else to deploy.`);
		return;
	}

	await waitForBuild(repo, branch, sha, credentials.ghToken);

	await deployToServers(target, image, sha, credentials, `https://github.com/${repo}`);
}
