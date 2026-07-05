/**
 * Build configuration.
 *
 * Extends the default `@wordpress/scripts` config. Because the source tree now
 * has a script module (the cockpit's `viewScriptModule`), the default export is
 * a pair of configs: a classic script config and a module config. The script
 * config builds the front-end placeholder and the admin sessions screen and
 * copies each block's `block.json` and `render.php` into `build/`; the module
 * config builds the cockpit's Interactivity API view as an ES module with
 * `@wordpress/interactivity` externalized. Both are returned untouched apart
 * from the script config's explicit entry points, the module config's added
 * dev-tools entry, and the DataViews stylesheet alias, so blocks, modules and
 * bundles all bind to WordPress's own packages.
 *
 * The dev-tools view module (`src/devtools/view.ts`) is not tied to a
 * `block.json`, so `@wordpress/scripts`' automatic module-entry discovery (which
 * scans for `viewScriptModule` fields) never finds it — it is added to the
 * module config's entry map by hand below, alongside the block-derived entries
 * it otherwise leaves untouched.
 */

const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

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
		index: path.resolve( process.cwd(), 'src', 'index.ts' ),
		sessions: path.resolve( process.cwd(), 'src', 'sessions', 'index.tsx' ),
		'admin-menu': path.resolve(
			process.cwd(),
			'src',
			'admin',
			'style.scss'
		),
		course: path.resolve( process.cwd(), 'src', 'course', 'style.scss' ),
		surfer: path.resolve( process.cwd(), 'src', 'surfer', 'index.ts' ),
		'cockpit-dashboard': path.resolve(
			process.cwd(),
			'src',
			'cockpit',
			'style.scss'
		),
		devtools: path.resolve(
			process.cwd(),
			'src',
			'devtools',
			'style.scss'
		),
	},
	resolve: {
		...scriptConfig.resolve,
		alias: {
			...scriptConfig.resolve?.alias,
			'dataviews-style.css': dataviewsStyle,
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
};

const devtoolsViewEntry = path.resolve(
	process.cwd(),
	'src',
	'devtools',
	'view.ts'
);

// The dev-tools module has no block.json to be discovered from, so it is added
// to the (single) module config's entry map by hand; every block-derived entry
// already there is left untouched. `@wordpress/scripts` hands back its module
// entry as a *function* (`getWebpackEntryPoints( 'module' )`, resolved lazily by
// webpack), not a plain object — spreading it directly (`{ ...moduleConfig.entry }`)
// would silently discard that function and, with it, every block-derived entry
// it would have found, so it is called through instead and its result merged.
const customModuleConfigs = moduleConfigs.map( ( moduleConfig, index ) => {
	if ( index !== 0 ) {
		return moduleConfig;
	}

	const originalEntry = moduleConfig.entry;

	return {
		...moduleConfig,
		entry: async () => {
			const resolved =
				typeof originalEntry === 'function'
					? await originalEntry()
					: originalEntry;

			return { ...resolved, 'devtools/view': devtoolsViewEntry };
		},
	};
} );

module.exports = [ customScriptConfig, ...customModuleConfigs ];
