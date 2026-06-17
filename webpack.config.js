/**
 * Build configuration.
 *
 * Extends the default `@wordpress/scripts` webpack config to declare the
 * plugin's entry points explicitly: the front-end placeholder bundle and the
 * admin sessions screen. Everything else — Babel, the dependency-extraction
 * plugin that externalizes `wp-*` scripts, CSS extraction — is inherited
 * untouched, so the DataViews bundle binds to WordPress's own packages. The one
 * addition is an alias that lets the screen bundle the DataViews stylesheet,
 * which WordPress does not expose as an enqueueable style handle.
 */

const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

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

module.exports = {
	...defaultConfig,
	entry: {
		index: path.resolve( process.cwd(), 'src', 'index.ts' ),
		sessions: path.resolve( process.cwd(), 'src', 'sessions', 'index.tsx' ),
	},
	resolve: {
		...defaultConfig.resolve,
		alias: {
			...defaultConfig.resolve?.alias,
			'dataviews-style.css': dataviewsStyle,
		},
	},
	module: {
		...defaultConfig.module,
		rules: [
			// `@wordpress/dataviews` declares `sideEffects: false`, so webpack
			// tree-shakes its stylesheet as an unused import and the grid ships
			// unstyled. Marking stylesheets as side-effectful keeps the import.
			{ test: /\.css$/, sideEffects: true },
			...defaultConfig.module.rules,
		],
	},
};
