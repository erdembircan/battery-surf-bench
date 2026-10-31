/**
 * The contract for what the distributable plugin zip may contain.
 *
 * `composer zip` builds the archive from the `.gitattributes` export-ignore
 * rules, and anything those rules miss ships silently: repository tooling, CI
 * configuration, untracked macOS metadata. These rules read only the archive's
 * entry names, so they are testable without a real zip. They cover the file
 * checks WordPress.org's Plugin Check runs on a submitted plugin, and also
 * reject hidden folders, which Plugin Check lets through.
 *
 * They also require every stylesheet to ship with its `-rtl.css` twin. The
 * plugin tells WordPress to serve the twin in place of the stylesheet on
 * right-to-left sites (see `Assets::enqueue()`), so a missing twin would leave
 * those sites unstyled. Only a release zip carries the compiled stylesheets,
 * so in practice this check bites in `bin/Release.sh`.
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
 * Returns an archive entry's path up to and including its first hidden
 * segment, so every file inside a hidden folder reports that folder.
 *
 * @param entry - An archive entry name, such as `assets/.DS_Store` or `assets/.cache/a.png`.
 * @return The hidden file's or folder's path, or null when no segment is hidden.
 */
function hiddenPathOf( entry: string ): string | null {
	const segments = entry.replace( /\/+$/, '' ).split( '/' );
	const index = segments.findIndex( ( segment ) =>
		segment.startsWith( '.' )
	);

	return index === -1 ? null : segments.slice( 0, index + 1 ).join( '/' );
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
	const hiddenPaths = new Set< string >();

	for ( const root of roots ) {
		if ( ! ALLOWED_ROOTS.includes( root ) ) {
			violations.push(
				`Unexpected top-level entry "${ root }": export-ignore it in .gitattributes, or add it to ALLOWED_ROOTS in bin/PackageRules.mts if the plugin needs it.`
			);
		}
	}

	for ( const entry of entries ) {
		const root = rootOf( entry );
		const hiddenPath = hiddenPathOf( entry );

		if (
			hiddenPath !== null &&
			ALLOWED_ROOTS.includes( root ) &&
			root !== 'vendor'
		) {
			hiddenPaths.add( hiddenPath );
		}
	}

	for ( const hiddenPath of hiddenPaths ) {
		violations.push(
			`Hidden file or folder "${ hiddenPath }": WordPress.org's Plugin Check rejects hidden files, so delete it or export-ignore it.`
		);
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

	const shipped = new Set( entries );

	for ( const entry of entries ) {
		if (
			rootOf( entry ) === 'vendor' ||
			! entry.endsWith( '.css' ) ||
			entry.endsWith( '-rtl.css' )
		) {
			continue;
		}

		const twin = `${ entry.slice( 0, -'.css'.length ) }-rtl.css`;

		if ( ! shipped.has( twin ) ) {
			violations.push(
				`Stylesheet "${ entry }" ships without its right-to-left twin "${ twin }": right-to-left sites load the twin in its place, so they would get none of its styles. Rebuild with wp-scripts, which writes the twin beside every stylesheet, and make sure .gitattributes does not export-ignore it.`
			);
		}
	}

	return violations;
}
