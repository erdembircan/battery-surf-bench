/**
 * Build configuration.
 *
 * Extends the default `@wordpress/scripts` config. Because the source tree now
 * has a script module (the cockpit's `viewScriptModule`), the default export is
 * a pair of configs: a classic script config and a module config. The script
 * config builds the admin screens, the start-benchmark nav script, the surfer
 * and the plugin's stylesheets, and copies each block's `block.json` and
 * `render.php` into `build/`; the module config builds the cockpit's
 * Interactivity API view as an ES module with `@wordpress/interactivity`
 * externalized. Both are returned untouched apart from the script config's
 * explicit entry points and stylesheet-only cleanup, the module config's added
 * dev-tools entry, the DataViews stylesheet alias, the `@` → `src` path alias
 * (mirroring the TypeScript/Vitest configs), the `BSB_DEV_TOOLS` constant and
 * the dropped right-to-left stylesheet step (see below), so blocks, modules and
 * bundles all bind to WordPress's own packages.
 *
 * The build has two variants, chosen by the `BSB_DEV_TOOLS` environment
 * variable: `pnpm run assets:development` and `pnpm start` set it to `true`,
 * and `pnpm run assets:production` leaves it unset. Only a development build
 * compiles the dev-tools panel's script module and stylesheet. Every config
 * also defines the `BSB_DEV_TOOLS` constant to match, through
 * `DevToolsFlagPlugin` (`bin/DevToolsFlagPlugin.cjs`), so a production build
 * drops the hooks the cockpit and the surfer keep for the panel.
 *
 * Several script entries are a single stylesheet. Webpack still writes a
 * JavaScript bundle and an `.asset.php` file for each, which nothing loads, so
 * `StyleOnlyEntriesPlugin` (`bin/StyleOnlyEntriesPlugin.cjs`) deletes them and
 * only their stylesheets reach `build/`.
 *
 * The dev-tools view module (`src/devtools/view.ts`) is not tied to a
 * `block.json`, so `@wordpress/scripts`' automatic module-entry discovery (which
 * scans for `viewScriptModule` fields) never finds it — it is added to the
 * module config's entry map by hand below, alongside the block-derived entries
 * it otherwise leaves untouched.
 *
 * The plugin does not support right-to-left languages: its design reads the
 * same way in every language and never mirrors. `@wordpress/scripts` adds an
 * RtlCssPlugin that writes an rtlcss-mirrored `-rtl.css` beside every
 * stylesheet, and nothing would ever serve those files, so that step is
 * filtered out of every config and the build writes no right-to-left
 * stylesheets.
 */

const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const RtlCssPlugin = require( '@wordpress/scripts/plugins/rtlcss-webpack-plugin' );
const StyleOnlyEntriesPlugin = require( './bin/StyleOnlyEntriesPlugin.cjs' );
const DevToolsFlagPlugin = require( './bin/DevToolsFlagPlugin.cjs' );

// Whether this is a development build, which carries the dev-tools panel (see
// the note at the top of this file).
const devTools = process.env.BSB_DEV_TOOLS === 'true';

// `@wordpress/scripts` returns `[ scriptConfig, moduleConfig ]` once the source
// tree contains a script module, or a lone script config otherwise. Normalize
// to an array so the module config (when present) passes through unchanged.
const configs = Array.isArray( defaultConfig )
	? defaultConfig
	: [ defaultConfig ];
const [ scriptConfig, ...moduleConfigs ] = configs;

// WordPress registers no `wp-dataviews` style handle for plugins, so the screen
// must bundle the DataViews stylesheet itself. Importing it by its
// `@wordpress/dataviews/...` path makes the dependency-extraction plugin treat
// it as a WordPress script and externalize it, so it never reaches css-loader.
// Aliasing it to a non-`@wordpress/` request sidesteps that: the externalizer
// ignores the request and css-loader extracts it into the bundle's stylesheet.
const dataviewsStyle = path.resolve(
	process.cwd(),
	'node_modules/@wordpress/dataviews/build-style/style.css'
);

const customScriptConfig = {
	...scriptConfig,
	entry: {
		sessions: path.resolve( process.cwd(), 'src', 'sessions', 'index.tsx' ),
		settings: path.resolve( process.cwd(), 'src', 'settings', 'index.tsx' ),
		'admin-menu': path.resolve(
			process.cwd(),
			'src',
			'styles',
			'admin',
			'style.scss'
		),
		'admin-start-benchmark': path.resolve(
			process.cwd(),
			'src',
			'admin',
			'StartBenchmarkLink.ts'
		),
		course: path.resolve(
			process.cwd(),
			'src',
			'styles',
			'course',
			'style.scss'
		),
		surfer: path.resolve( process.cwd(), 'src', 'surfer', 'index.ts' ),
		'cockpit-dashboard': path.resolve(
			process.cwd(),
			'src',
			'styles',
			'cockpit',
			'style.scss'
		),
		...( devTools && {
			devtools: path.resolve(
				process.cwd(),
				'src',
				'styles',
				'devtools',
				'style.scss'
			),
		} ),
	},
	resolve: {
		...scriptConfig.resolve,
		alias: {
			...scriptConfig.resolve?.alias,
			'dataviews-style.css': dataviewsStyle,
			'@': path.resolve( process.cwd(), 'src' ),
		},
	},
	module: {
		...scriptConfig.module,
		rules: [
			// `@wordpress/dataviews` declares `sideEffects: false`, so webpack
			// tree-shakes its stylesheet as an unused import and the grid ships
			// unstyled. Marking stylesheets as side-effectful keeps the import.
			{ test: /\.css$/, sideEffects: true },
			...scriptConfig.module.rules,
		],
	},
	// Deletes the stylesheet-only entries' empty bundles and asset files (see
	// the note at the top of this file).
	plugins: [
		...( scriptConfig.plugins ?? [] ),
		new StyleOnlyEntriesPlugin(),
	],
};

const devtoolsViewEntry = path.resolve(
	process.cwd(),
	'src',
	'devtools',
	'view.ts'
);

// The dev-tools module has no block.json to be discovered from, so a
// development build adds it to the (single) module config's entry map by hand,
// and a production build leaves it out; every block-derived entry
// already there is left untouched. `@wordpress/scripts` hands back its module
// entry as a *function* (`getWebpackEntryPoints( 'module' )`, resolved lazily by
// webpack), not a plain object — spreading it directly (`{ ...moduleConfig.entry }`)
// would silently discard that function and, with it, every block-derived entry
// it would have found, so it is called through instead and its result merged.
const customModuleConfigs = moduleConfigs.map( ( moduleConfig, index ) => {
	const withAlias = {
		...moduleConfig,
		resolve: {
			...moduleConfig.resolve,
			alias: {
				...moduleConfig.resolve?.alias,
				'@': path.resolve( process.cwd(), 'src' ),
			},
		},
	};

	if ( index !== 0 ) {
		return withAlias;
	}

	const originalEntry = moduleConfig.entry;

	return {
		...withAlias,
		entry: async () => {
			const resolved =
				typeof originalEntry === 'function'
					? await originalEntry()
					: originalEntry;

			return devTools
				? { ...resolved, 'devtools/view': devtoolsViewEntry }
				: resolved;
		},
	};
} );

/**
 * Drops `@wordpress/scripts`' right-to-left stylesheet step from a config, so
 * the build writes no `-rtl.css` files (see the note at the top of this file).
 *
 * @param {Object} config A webpack config.
 * @return {Object} The same config without the RtlCssPlugin.
 */
const withoutRtlStylesheets = ( config ) => ( {
	...config,
	plugins: ( config.plugins ?? [] ).filter(
		( plugin ) => ! ( plugin instanceof RtlCssPlugin )
	),
} );

/**
 * Adds `DevToolsFlagPlugin` to a config, so the code it compiles sees the
 * `BSB_DEV_TOOLS` constant this build's variant sets (see the note at the top
 * of this file).
 *
 * @param {Object} config A webpack config.
 * @return {Object} The same config, defining `BSB_DEV_TOOLS`.
 */
const withDevToolsFlag = ( config ) => ( {
	...config,
	plugins: [
		...( config.plugins ?? [] ),
		new DevToolsFlagPlugin( devTools ),
	],
} );

module.exports = [ customScriptConfig, ...customModuleConfigs ]
	.map( withoutRtlStylesheets )
	.map( withDevToolsFlag );
