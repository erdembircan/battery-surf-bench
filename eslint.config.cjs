/**
 * Project ESLint flat config.
 *
 * Builds on the default config shipped with `@wordpress/scripts`, with two
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
 * It also points the already-enabled `@wordpress/i18n-text-domain` rule at this
 * plugin's text domain. The default config turns the rule on but configures no
 * domain, so a wrong/missing JS text domain passes; naming the domain makes
 * `__()`/`_x()`/etc. with the wrong domain fail lint — the JS counterpart of the
 * `WordPress.WP.I18n` phpcs rule.
 */

const defaultConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );

const TS_MODULE_GLOBS = [ '**/*.mts', '**/*.cts' ];

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

module.exports = [
	...withTsModules,
	{ ignores: [ '.claude/**', 'wp-playground/wordpress/**' ] },
	{
		rules: {
			'@wordpress/i18n-text-domain': [
				'error',
				{ allowedTextDomain: 'battery-surf-bench' },
			],
		},
	},
];
