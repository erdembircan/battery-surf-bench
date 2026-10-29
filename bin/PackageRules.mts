/**
 * The contract for what the distributable plugin zip may contain.
 *
 * `composer zip` builds the archive from the `.gitattributes` export-ignore
 * rules, and anything those rules miss ships silently: repository tooling, CI
 * configuration, untracked macOS metadata. These rules read only the archive's
 * entry names, so they are testable without a real zip. They mirror the file
 * checks WordPress.org's Plugin Check runs on a submitted plugin.
 */

/**
 * Top-level entries the zip may contain: the plugin's code, assets and
 * translations, its production Composer dependencies with the `composer.json`
 * WordPress.org asks for, and the plugin's readme and license.
 */
const ALLOWED_ROOTS: readonly string[] = [
	'battery-surf-bench.php',
	'readme.txt',
	'LICENSE',
	'composer.json',
	'assets',
	'build',
	'includes',
	'languages',
	'vendor',
];

/** Top-level entries every zip must contain. */
const REQUIRED_ROOTS: readonly string[] = [
	'battery-surf-bench.php',
	'readme.txt',
	'LICENSE',
	'includes',
];

/**
 * Top-level entries only a release zip must contain: the compiled bundles and
 * the production `vendor/` tree `bin/Release.sh` builds. A plain `composer zip`
 * of a checkout has neither.
 */
const RELEASE_ROOTS: readonly string[] = [ 'build', 'vendor' ];

export interface PackageRulesOptions {
	release: boolean;
}

/**
 * Returns the first path segment of an archive entry.
 *
 * @param entry - An archive entry name, such as `includes/Plugin.php` or `assets/`.
 * @return The entry's top-level file or folder name.
 */
function rootOf( entry: string ): string {
	return entry.split( '/' )[ 0 ];
}

/**
 * Returns the last path segment of an archive entry, ignoring the trailing
 * slash that marks a folder entry.
 *
 * @param entry - An archive entry name.
 * @return The entry's own file or folder name.
 */
function nameOf( entry: string ): string {
	const segments = entry.replace( /\/+$/, '' ).split( '/' );

	return segments[ segments.length - 1 ];
}

/**
 * Checks a plugin zip's entry names against the package contract.
 *
 * @param entries - Every entry name in the zip, as `unzip -Z1` lists them.
 * @param options - Set `release` to also require the release-only entries.
 * @return One message per violation; empty when the zip is clean.
 */
export function findPackageViolations(
	entries: readonly string[],
	options: PackageRulesOptions
): string[] {
	const violations: string[] = [];
	const roots = new Set( entries.map( rootOf ) );

	for ( const root of roots ) {
		if ( ! ALLOWED_ROOTS.includes( root ) ) {
			violations.push(
				`Unexpected top-level entry "${ root }": export-ignore it in .gitattributes, or add it to ALLOWED_ROOTS in bin/PackageRules.mts if the plugin needs it.`
			);
		}
	}

	for ( const entry of entries ) {
		const root = rootOf( entry );

		if (
			ALLOWED_ROOTS.includes( root ) &&
			root !== 'vendor' &&
			nameOf( entry ).startsWith( '.' )
		) {
			violations.push(
				`Hidden file "${ entry }": WordPress.org's Plugin Check rejects hidden files, so delete it or export-ignore it.`
			);
		}
	}

	const required = options.release
		? [ ...REQUIRED_ROOTS, ...RELEASE_ROOTS ]
		: REQUIRED_ROOTS;

	for ( const root of required ) {
		if ( ! roots.has( root ) ) {
			violations.push( `Missing required entry "${ root }".` );
		}
	}

	if ( roots.has( 'vendor' ) && ! roots.has( 'composer.json' ) ) {
		violations.push(
			'"vendor/" ships without "composer.json": WordPress.org asks for composer.json alongside Composer dependencies.'
		);
	}

	return violations;
}
