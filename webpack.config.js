/**
 * Build configuration.
 *
 * Extends the default `@wordpress/scripts` webpack config to declare the
 * plugin's entry points explicitly: the front-end placeholder bundle and the
 * admin sessions screen. Everything else — Babel, the dependency-extraction
 * plugin that externalizes `wp-*` scripts, CSS extraction — is inherited
 * untouched, so the DataViews bundle binds to WordPress's own packages.
 */

const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: {
		index: path.resolve( process.cwd(), 'src', 'index.ts' ),
		sessions: path.resolve( process.cwd(), 'src', 'sessions', 'index.tsx' ),
	},
};
