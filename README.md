# battery-surf-bench

WordPress plugin that benchmarks battery drain while simulating browsing.

## Development

### Prerequisites

- Node.js ≥ 20.18 and [pnpm](https://pnpm.io) (the package manager is pinned in
  `package.json`; run `corepack enable` once to have the right version activate
  automatically)
- PHP ≥ 8.1 and Composer

### Setup

```bash
composer install   # PHP dependencies (required — the plugin loads vendor/autoload.php)
pnpm install       # JS/TS toolchain, Playground CLI, Playwright
```

### Build the assets

The front-end bundle is built with [`@wordpress/scripts`](https://www.npmjs.com/package/@wordpress/scripts):

```bash
pnpm run build      # one-off production build into build/
pnpm run start      # watch + rebuild on change
```

### Local dev server (WordPress Playground)

A disposable WordPress instance runs locally in WebAssembly via
[`@wp-playground/cli`](https://www.npmjs.com/package/@wp-playground/cli). The plugin
is mounted and activated, you are logged in as `admin`, and the install persists in
`wp-playground/wordpress/` between restarts.

```bash
pnpm run playground        # start the dev server at http://127.0.0.1:9400
pnpm run playground:fresh  # wipe the persisted install and start over
```

For a full live-reload loop — rebuild JS on change *and* reload the browser when PHP
or built assets change — run:

```bash
pnpm run dev               # @wordpress/scripts watch + dev server + LiveReload
```

Then open <http://127.0.0.1:9400>. Editing PHP or rebuilding the bundle reloads the
open page in place. (Playground has no built-in live reload; LiveReload is used
instead of a proxy because Playground's auto-login redirect is incompatible with
proxy-based reloaders.)

### End-to-end tests (Playwright)

E2E specs run against a fresh, non-persistent Playground instance booted from the
e2e blueprint (deterministic, logged-in, plugin-active).

```bash
pnpm run test:e2e:install  # one-time: download the Playwright browser
pnpm run test:e2e          # build, boot Playground, run specs
```

### Other checks

```bash
pnpm run typecheck         # tsc --noEmit over src, scripts, and specs
pnpm run lint:js           # @wordpress/scripts lint-js
composer test             # PHPUnit
composer lint             # PHPCS / WPCS
```

### Playground internals

`wp-playground/` holds the Playground tooling:

- `blueprint.mts` — the shared dev and e2e blueprints (steps, versions, plugin activation)
- `config.mts` — ports, URLs, and the Playwright readiness marker
- `start.mts` — persistent dev server (`pnpm run playground`)
- `start-test.mts` / `start-test-server.mts` — non-persistent e2e server
- `live-reload.mts` — LiveReload file watcher (`pnpm run dev:sync`)
