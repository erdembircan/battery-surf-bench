/**
 * Project ESLint flat config.
 *
 * Extends the default config shipped with `@wordpress/scripts`. That default
 * applies its TypeScript treatment only to `.ts`/`.tsx` files, so `.mts`/`.cts`
 * modules (the Playground tooling and e2e specs) were being parsed as plain
 * JavaScript -- which misreports type-only imports as unused and demands the
 * redundant JSDoc `@param`/`@return` types this project deliberately omits.
 *
 * Rather than redeclare the TypeScript parser, plugin, and rules (and pull in
 * `typescript-eslint` as a direct dependency), reuse the exact block the
 * default config already builds and extend its file globs to cover the
 * additional module extensions.
 *
 * The default config ignores `node_modules`, `build` and `vendor` but not the
 * Playground WordPress install, which `npm run playground` downloads into
 * `wp-playground/wordpress/` — hundreds of core JS files that would otherwise be
 * linted, turning a sub-second run into a minute-long one. Ignore that tree too.
 */

const wpScriptsConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );

const tsBlock = wpScriptsConfig.find(
	( entry ) =>
		Array.isArray( entry.files ) &&
		entry.files.includes( '**/*.ts' ) &&
		entry.languageOptions?.parser
);

module.exports = [
	{ ignores: [ 'wp-playground/wordpress/**' ] },
	...wpScriptsConfig,
	...( tsBlock ? [ { ...tsBlock, files: [ '**/*.mts', '**/*.cts' ] } ] : [] ),
];
