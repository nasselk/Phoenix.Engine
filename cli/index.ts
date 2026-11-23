#!/usr/bin/env bun
import { deploy } from "./deploy";
import { initServer } from "./init-server";

const HELP = `phoenix: deploy a Phoenix Engine game. Run it from the game's root folder.

  phoenix deploy               bump the version, tag it, move the deploy branch, restart its servers
  phoenix init-server <host>   prepare a fresh Ubuntu server from scripts/servers.json for deploys
  phoenix init-server          list the hosts in scripts/servers.json
`;

const [command, ...args] = process.argv.slice(2);

try {
	switch (command) {
		case "deploy":
			await deploy();
			break;
		case "init-server":
			await initServer(args[0]);
			break;
		case undefined:
		case "help":
		case "--help":
		case "-h":
			console.log(HELP);
			break;
		default:
			console.error(`Unknown command: ${command}\n\n${HELP}`);
			process.exitCode = 1;
	}
} catch (err) {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
}
