/**
 * The contract for what the distributable plugin zip may contain.
 *
 * `composer zip` builds the archive from the `.gitattributes` export-ignore
 * rules, and anything those rules miss ships silently: repository tooling, CI
 * configuration, untracked macOS metadata. These rules read only the archive's
 * entry names, so they are testable without a real zip. They hold the zip to
 * its own contract (allowed and required top-level entries, no hidden files
 * or folders outside `vendor/`, `composer.json` alongside `vendor/`) and to
 * the file checks WordPress.org's upload form runs before anything else: no
 * version-control folder, and no archive, `.phar` or `.sh` file, anywhere in
 * the zip. Plugin Check's own file checks, which the form runs next, are left
 * to Plugin Check itself: the `plugin-check` CI job runs it on the release
 * build.
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

/** Folder names that mark a version-control checkout, which the upload form refuses. */
const VCS_FOLDERS: readonly string[] = [ '.git', '.svn', '.hg', '.bzr' ];

/** File extensions the upload form refuses: archives, `.phar` and shell scripts. */
const FORBIDDEN_EXTENSIONS: readonly string[] = [
	'zip',
	'gz',
	'tgz',
	'rar',
	'tar',
	'7z',
	'phar',
	'sh',
];

/** The size the upload form takes zips under, in bytes: 10 MB, read as decimal megabytes, the stricter reading. */
export const MAX_ZIP_BYTES = 10_000_000;

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
 * Returns the paths of an archive entry's version-control folders, each path
 * running up to and including the folder's segment. A segment counts as a
 * folder when it is not the entry's last segment, or when the entry itself is
 * a folder entry ending in `/`.
 *
 * @param entry - An archive entry name, such as `vendor/psr/container/.svn/entries` or `assets/.hg/`.
 * @return The version-control folder paths the entry sits in or is.
 */
function vcsFolderPathsOf( entry: string ): string[] {
	const isFolderEntry = entry.endsWith( '/' );
	const segments = entry.replace( /\/+$/, '' ).split( '/' );
	const paths: string[] = [];

	segments.forEach( ( segment, index ) => {
		const isFolder = isFolderEntry || index < segments.length - 1;

		if ( isFolder && VCS_FOLDERS.includes( segment.toLowerCase() ) ) {
			paths.push( segments.slice( 0, index + 1 ).join( '/' ) );
		}
	} );

	return paths;
}

/**
 * Returns the extension that makes the upload form refuse a file entry.
 *
 * @param entry - An archive entry name, such as `build/bundle.tar` or `assets/`.
 * @return The forbidden extension, lowercased, or null for a folder entry or an allowed file.
 */
function forbiddenExtensionOf( entry: string ): string | null {
	if ( entry.endsWith( '/' ) ) {
		return null;
	}

	const lowerEntry = entry.toLowerCase();

	return (
		FORBIDDEN_EXTENSIONS.find( ( extension ) =>
			lowerEntry.endsWith( `.${ extension }` )
		) ?? null
	);
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
	const vcsPaths = new Set< string >();
	const forbiddenFiles = new Map< string, string >();

	for ( const root of roots ) {
		if ( ! ALLOWED_ROOTS.includes( root ) ) {
			violations.push(
				`Unexpected top-level entry "${ root }": export-ignore it in .gitattributes, or add it to ALLOWED_ROOTS in bin/PackageRules.mts if the plugin needs it.`
			);
		}
	}

	// A checkout zip's vendor/ holds dev packages that never ship, so the
	// upload form's file rules only apply to it in a release zip.
	const upload = entries.filter(
		( entry ) => options.release || rootOf( entry ) !== 'vendor'
	);

	for ( const entry of upload ) {
		for ( const vcsPath of vcsFolderPathsOf( entry ) ) {
			vcsPaths.add( vcsPath );
		}

		const extension = forbiddenExtensionOf( entry );

		if ( extension !== null ) {
			forbiddenFiles.set( entry, extension );
		}
	}

	for ( const entry of entries ) {
		const root = rootOf( entry );
		const hiddenPath = hiddenPathOf( entry );

		// A version-control folder is reported once, as one, not also as hidden.
		if (
			hiddenPath !== null &&
			! vcsPaths.has( hiddenPath ) &&
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

	for ( const path of vcsPaths ) {
		violations.push(
			`Version-control folder "${ path }": WordPress.org's upload form refuses a zip that contains one, so delete it or export-ignore it.`
		);
	}

	for ( const [ entry, extension ] of forbiddenFiles ) {
		violations.push(
			`Forbidden file "${ entry }": WordPress.org's upload form refuses a zip that contains a .${ extension } file, so delete it or export-ignore it.`
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

	return violations;
}

/**
 * Checks a plugin zip's size against the limit WordPress.org's upload form sets.
 *
 * @param bytes   - The zip's size in bytes.
 * @param options - Set `release` to apply the limit; a checkout zip is never uploaded.
 * @return One message when a release zip reaches the limit; empty otherwise.
 */
export function findSizeViolations(
	bytes: number,
	options: PackageRulesOptions
): string[] {
	if ( ! options.release || bytes < MAX_ZIP_BYTES ) {
		return [];
	}

	const megabytes = ( bytes / 1_000_000 ).toFixed( 1 );

	return [
		`Zip is ${ megabytes } MB: WordPress.org's upload form takes zips under 10 MB, so leave out what the plugin doesn't need.`,
	];
}
