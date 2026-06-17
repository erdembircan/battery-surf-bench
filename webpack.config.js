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
 * from the script config's explicit entry points and the DataViews stylesheet
 * alias, so blocks, modules and bundles all bind to WordPress's own packages.
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

module.exports = [ customScriptConfig, ...moduleConfigs ];
