<div style="pointer-events: none;">
    <img src="./client/public/assets/logo.webp" height="100">
</div>


## Table of contents
- [Documentation](#documentation)
- [Stack](#stack)
- [Requirements](#requirements)
- [How to run in development](#how-to-run-in-development)
- [How to deploy](#how-to-deploy)
- [Environment variables](#environment-variables)
- [Assets](#assets)
- [Libraries](#libraries)
- [License](#license)

## Documentation

*Coming soon*


## Stack

**Client:** [`TypeScript`](https://www.typescriptlang.org/), [`Svelte`](https://svelte.dev/), [`Vite`](https://vite.dev/)

**Server:** [`TypeScript`](https://www.typescriptlang.org/), [`Bun.JS`](https://bun.sh/)

## Requirements

1. [`Bun.JS`](https://bun.sh/) is required to run the server, dev server and to build the project
2. A modern web browser support is required to run the client


## How to run in development

***For the first time:***

1. Clone the repository
2. Run the init command:
```pwsh
bun run init
```

***Then:***

1. Run the dev command:
```pwsh
bun start
```

2. It should directly open the client in your browser with automatic reload. If it doesn't or you want to access it again, reach [*`http://localhost:5173`*](http://localhost:5173) in your browser
3. You can restart the game server by writing `rs + Enter` in the terminal

This will spawn the game server listening on port `443` (watching for changes), and a web server ([*Vite*](https://vite.dev/)) on port `5173`.


## How to deploy

To build and deploy, run the following command :

```pwsh
bun run deploy
```

This command will do in this order :

1) Bump the version and synchronise the `release` branch with the `main` branch
2) This will trigger Cloudflare to build the client and deploy it to production automatically
3) In parallel, GitHub actions workflow will build the docker image and push it to the registry
4) Wait for the GitHub Actions build to complete, then pull the latest image on all servers listed in [servers.json](./shared/servers.json) and restart them


## Environment variables

The server uses the following environment variables ([.env.template](./server/env/.env.template)):

| Name | Description | Default value |
| --- | --- | --- |
| `ENV` | The environment in which the server is running. Can be either `development` or `production`. | `development` |
| `TLS` | Whether to use TLS (HTTPS) or not. If set to `true`, the server will use TLS. | `false` |
| `PORT` | The port on which the server will listen. | `443` |
| `ALLOWED_ORIGINS` | A comma-separated list of allowed origins for CORS. | `*` |
| `DATABASE_HOST` | The host of the database. | `your_db_connection_string` |
| `DATABASE_PORT` | The port of the database. | `your_db_port` |
| `DATABASE_USER` | The user of the database. | `your_db_user` |
| `DATABASE_PASSWORD` | The password of the database. | `your_db_password` |
| `DATABASE_NAME` | The name of the database. | `your_db_name` |
| `API_KEY` | The API key used for authentication. | `your_secret` |
| `TURNSTILE_SECRET` | The secret key for Cloudflare Turnstile. | `your_turnstile_secret_key` |
| `UWS_HTTP_MAX_HEADERS_SIZE` | The maximum size of HTTP headers in bytes. | `16384` | 


## Assets

For best performance, either use WebP (loading speed) or KTX2 (rendering speed).

- WebP encoders can be downloaded at: [WebP encoders](https://storage.googleapis.com/downloads.webmproject.org/releases/webp/index.html)
- KTX2 encoders can be downloaded at: [KTX2 encoders](https://github.com/KhronosGroup/KTX-Software/releases)


## Libraries

- [pixi.js](https://pixijs.com/) as the rendering part is a light wrapper of the pixi.js library
- [svelte](https://svelte.dev) for the user interface


## License

**© 2026 All Rights Reserved**

The game engine and all associated code are proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

**No license is granted for use of this code.** Any use, reproduction, or distribution requires prior written authorization.

For licensing inquiries, please contact at: nassim.elkarati@gmail.com