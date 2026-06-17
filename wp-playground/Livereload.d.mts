// Augments the stale `@types/livereload` definitions, which omit the `host`
// option even though the runtime package reads `config.host` (defaulting it to
// `localhost`). The dev live-reload server relies on `host` to bind the IPv4
// loopback; without this declaration `createServer` rejects the option.
declare module 'livereload' {
	interface ServerConfig {
		/** Host the LiveReload server binds to. Defaults to `localhost`. */
		host?: string | undefined;
	}
}

export {};
