import { spawn } from "node:child_process";

export function runGit(...args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn("git", args, {
			stdio: "inherit",
			shell: false,
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`git ${args.join(" ")} failed with exit code ${code}`));
			}
		});
	});
}

export function readGit(...args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("git", args, { shell: false });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
		child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`));
		});
	});
}

export function add(...files: string[]): Promise<void> {
	if (files.length === 0) {
		throw new Error("At least one file must be specified for git add");
	}

	return runGit("add", ...files);
}

export async function commit(message: string, stageAll: boolean = false): Promise<void> {
	if (!message) {
		throw new Error("commit message is required");
	}

	if (stageAll) {
		await runGit("add", "--all");
	}

	return runGit("commit", "-m", message);
}

export async function push(): Promise<void> {
	return runGit("push");
}

export async function tagExists(name: string): Promise<boolean> {
	const local = await readGit("tag", "--list", name);
	const remote = await readGit("ls-remote", "--tags", "origin", `refs/tags/${name}`);

	return local !== "" || remote !== "";
}

export async function tag(name: string, message: string): Promise<void> {
	await runGit("tag", "--annotate", name, "--message", message);

	return runGit("push", "origin", `refs/tags/${name}`);
}

export async function checkout(branch: string): Promise<void> {
	if (!branch) {
		throw new Error("branch name is required for git checkout");
	}

	return runGit("checkout", branch);
}

export async function mirror(source: string, destination: string): Promise<void> {
	if (!source) {
		throw new Error("source branch name is required for git mirror");
	}

	if (!destination) {
		throw new Error("destination branch name is required for git mirror");
	}

	const exists = (await readGit("ls-remote", "--heads", "origin", destination)) !== "";

	await runGit("fetch", "origin", source, ...(exists ? [destination] : []));

	return runGit("push", ...(exists ? ["--force-with-lease"] : []), "origin", `refs/remotes/origin/${source}:refs/heads/${destination}`);
}
