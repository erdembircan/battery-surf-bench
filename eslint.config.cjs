/**
 * Project ESLint flat config.
 *
 * Builds on the default config shipped with `@wordpress/scripts`, with three
 * project-specific adjustments it cannot know about:
 *
 * 1. TypeScript module extensions. wp-scripts applies its TypeScript parser and
 *    type-aware rule overrides only to `.ts`/`.tsx`. We also author `.mts`/`.cts`
 *    (Playground tooling, e2e specs, build configs) — development files we want
 *    linted exactly like the rest of our TypeScript. Extend every TS-targeted
 *    block to also match `.mts`/`.cts`, so they get the real parser instead of
 *    being read as plain JavaScript (which misreads type-only imports as unused
 *    and demands the redundant JSDoc types this project omits).
 *
 * 2. Ignores. Lint runs across the whole project, so skip the code that is not
 *    ours: the WordPress instance `pnpm run playground` downloads into
 *    `wp-playground/wordpress/**`, and the agent worktrees under `.claude/**`
 *    (each a full copy of the repo). `node_modules`, `build`, and `vendor` are
 *    already ignored by the default config.
 *
 * 3. `.gitignore` files. `eslint-plugin-dotignore` lints them as their own
 *    ESLint language, through its recommended preset. Most of the default
 *    config's blocks name no `files`, so ESLint would run their JavaScript
 *    rules (Prettier's included) on `.gitignore` too, and those rules crash on
 *    a file that isn't JavaScript. Each such block is scoped to the script
 *    files the config already linted (`SCRIPT_GLOBS`). A block that lists only
 *    `ignores` stays unscoped, because that shape is what makes its ignores
 *    global.
 *
 * It also points the already-enabled `@wordpress/i18n-text-domain` rule at this
 * plugin's text domain. The default config turns the rule on but configures no
 * domain, so a wrong/missing JS text domain passes; naming the domain makes
 * `__()`/`_x()`/etc. with the wrong domain fail lint — the JS counterpart of the
 * `WordPress.WP.I18n` phpcs rule.
 */

const defaultConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );

// The plugin ships only as an ES module and needs Node 22.18 or later. That is
// also new enough for `require()` to load an ES module; the plugin itself is
// the module's default export.
const dotignore = require( 'eslint-plugin-dotignore' ).default;

const TS_MODULE_GLOBS = [ '**/*.mts', '**/*.cts' ];

/**
 * The script files the default config was written for: the extensions ESLint
 * lints on its own (`.js`, `.mjs`, `.cjs`) plus the TypeScript ones its
 * TypeScript blocks target.
 */
const SCRIPT_GLOBS = [ '**/*.{js,mjs,cjs,ts,tsx,mts,cts}' ];

// Mirror wp-scripts' TypeScript treatment onto the `.mts`/`.cts` modules we also
// author by adding those extensions to every block that already targets
// `.ts`/`.tsx`. Keying on the `files` globs (rather than a single block) keeps
// this robust to changes in the default config's internal shape.
const withTsModules = defaultConfig.map( ( block ) =>
	Array.isArray( block.files ) &&
	block.files.some( ( glob ) => glob === '**/*.ts' || glob === '**/*.tsx' )
		? {
				...block,
				files: [ ...new Set( [ ...block.files, ...TS_MODULE_GLOBS ] ) ],
		  }
		: block
);

/**
 * Scopes a config block that names no `files` to the script files, so its
 * JavaScript rules never run on a `.gitignore`. A block holding nothing but
 * `ignores` (and an optional `name`) is returned as is: ESLint treats that
 * shape's ignores as global, and a `files` key would quietly narrow them.
 *
 * @param {Object} block A flat-config block.
 * @return {Object} The block, scoped to the script files when it named none.
 */
const scopeToScripts = ( block ) => {
	const onlyIgnores = Object.keys( block ).every(
		( key ) => key === 'ignores' || key === 'name'
	);

	return block.files || onlyIgnores
		? block
		: { ...block, files: SCRIPT_GLOBS };
};

module.exports = [
	...withTsModules.map( scopeToScripts ),
	{ ignores: [ '.claude/**', 'wp-playground/wordpress/**' ] },
	{
		files: SCRIPT_GLOBS,
		rules: {
			'@wordpress/i18n-text-domain': [
				'error',
				{ allowedTextDomain: 'battery-surf-bench' },
			],
		},
	},
	{
		files: [ 'src/**/*.ts', 'src/**/*.tsx' ],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: [ './*', '../*' ],
							message:
								'Use the @/ path alias instead of relative imports.',
						},
					],
				},
			],
		},
	},
	dotignore.configs.recommended,
];
