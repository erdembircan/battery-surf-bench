/**
 * The contract for what a built plugin zip may contain.
 *
 * `composer zip:development` and `composer zip:production` zip the plugin
 * folder the build assembles from the `.gitattributes` export-ignore rules and
 * the compiled `build/`, and anything those let through ships silently:
 * repository tooling, CI configuration, untracked macOS metadata. These rules
 * read only the zip's entry names, and the production zip's scripts, so they
 * are testable without a real zip. They hold every zip to its own contract
 * (every entry inside one top-level `battery-surf-bench/` folder, allowed and
 * required entries at the top of that folder, no hidden files or folders
 * outside `vendor/`, no bundled translations, `composer.json` alongside
 * `vendor/`) and to the file checks WordPress.org's upload form runs before
 * anything else: no version-control folder, and no archive, `.phar` or `.sh`
 * file, anywhere in the zip. The production zip must also leave the dev-tools
 * panel out, its code included, and stay under the form's 10 MB limit; the
 * development zip must carry the panel. Plugin Check's own file checks, which
 * the form runs next, are left to Plugin Check itself: the `plugin-check` CI
 * job runs it on the production build.
 */

import { PLUGIN_SLUG, type PackageVariant } from './PackageLayout.mts';

/**
 * Entries the plugin folder may hold at its top: the plugin's code, compiled
 * bundles, its production Composer dependencies with the
 * `composer.json` WordPress.org asks for, and the plugin's readme and license.
 * `assets/` isn't one: the stylesheets inline its images at build time.
 */
const ALLOWED_ROOTS: readonly string[] = [
	'battery-surf-bench.php',
	'readme.txt',
	'LICENSE',
	'composer.json',
	'build',
	'includes',
	'vendor',
];

/**
 * Entries the plugin folder must hold at its top. Every zip is built, so the
 * compiled bundles and the production `vendor/` tree are among them.
 */
const REQUIRED_ROOTS: readonly string[] = [
	'battery-surf-bench.php',
	'readme.txt',
	'LICENSE',
	'includes',
	'build',
	'vendor',
];

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

/**
 * Bundled translations. WordPress.org serves the plugin's translations from
 * translate.wordpress.org, and its review rejects a plugin that ships its own,
 * so the repository keeps no `languages/` folder and a zip that holds one has
 * picked up translation files that don't belong.
 */
const TRANSLATION_FILE = /^languages(?:\/|$)/;

/**
 * The dev-tools panel's files: its PHP, which the production build leaves out
 * of the plugin folder, and its script and stylesheet, which only a
 * development build compiles.
 */
const DEV_TOOLS_FILE =
	/^(?:includes\/DevTools|build\/devtools)(?:\/|$)|^build\/(?:style-devtools\.css|devtools\.(?:js|asset\.php))$/;

/** Files whose presence shows a development zip carries the dev-tools panel. */
const DEV_TOOLS_REQUIRED: readonly string[] = [
	'includes/DevTools/DevTools.php',
	'build/devtools/view.js',
	'build/style-devtools.css',
];

/**
 * Strings that only the dev-tools code puts into a script: the sterile run's
 * URL parameter, the message the sterile surfer is steered by, and the shared
 * dev-tools state key. A production script that contains one still carries
 * dev-tools code the build should have compiled out.
 */
const DEV_TOOLS_CODE_MARKERS: readonly string[] = [
	'bsbenchSterile',
	'bsb:steerBehavior',
	'.devtools',
];

/** The size the upload form takes zips under, in bytes: 10 MB, read as decimal megabytes, the stricter reading. */
export const MAX_ZIP_BYTES = 10_000_000;

export interface PackageRulesOptions {
	variant: PackageVariant;
}

export interface PackagedScript {
	path: string;
	content: string;
}

/**
 * Returns the first path segment of an archive entry.
 *
 * @param entry - An archive entry name, such as `includes/Plugin.php` or `build/`.
 * @return The entry's top-level file or folder name.
 */
function rootOf( entry: string ): string {
	return entry.split( '/' )[ 0 ];
}

/**
 * Returns an archive entry's path up to and including its first hidden
 * segment, so every file inside a hidden folder reports that folder.
 *
 * @param entry - An archive entry name, such as `includes/.DS_Store` or `includes/.cache/a.php`.
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
 * @param entry - An archive entry name, such as `vendor/psr/container/.svn/entries` or `languages/.hg/`.
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
 * @param entry - An archive entry name, such as `build/bundle.tar` or `includes/`.
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
 * Checks a plugin zip's entry names against the package contract. An entry
 * outside the plugin folder is reported by its top-level name, once; every
 * other rule reads, and reports, paths inside the folder.
 *
 * @param entries - Every entry name in the zip, as `unzip -Z1` lists them.
 * @param options - The build variant the zip comes from.
 * @return One message per violation; empty when the zip is clean.
 */
export function findPackageViolations(
	entries: readonly string[],
	options: PackageRulesOptions
): string[] {
	const violations: string[] = [];
	const folderPrefix = `${ PLUGIN_SLUG }/`;
	const outsideRoots = new Set(
		entries
			.filter( ( entry ) => ! entry.startsWith( folderPrefix ) )
			.map( rootOf )
	);

	for ( const root of outsideRoots ) {
		violations.push(
			`Entry "${ root }" is outside the "${ folderPrefix }" folder: the zip must hold the whole plugin in that one top-level folder, as the Composer zip scripts build it, or a manual install puts the plugin in a randomly named folder.`
		);
	}

	// Every other rule reads, and reports, paths inside the plugin folder. The
	// folder's own entry, when the zip has one, names nothing inside it.
	const pluginEntries = entries
		.filter( ( entry ) => entry.startsWith( folderPrefix ) )
		.map( ( entry ) => entry.slice( folderPrefix.length ) )
		.filter( ( entry ) => entry !== '' );

	// A zip with nothing in the folder, such as one with the plugin's files at
	// its root, would also miss every required entry. Its outside entries
	// already say what is wrong.
	if ( pluginEntries.length === 0 && outsideRoots.size > 0 ) {
		return violations;
	}

	const roots = new Set( pluginEntries.map( rootOf ) );
	const hiddenPaths = new Set< string >();
	const vcsPaths = new Set< string >();
	const forbiddenFiles = new Map< string, string >();

	for ( const root of roots ) {
		// A `languages/` entry gets its own, more specific message below.
		if (
			! ALLOWED_ROOTS.includes( root ) &&
			! TRANSLATION_FILE.test( root )
		) {
			violations.push(
				`Unexpected entry "${ root }" in the plugin folder: export-ignore it in .gitattributes, or add it to ALLOWED_ROOTS in bin/PackageRules.mts if the plugin needs it.`
			);
		}
	}

	for ( const entry of pluginEntries ) {
		for ( const vcsPath of vcsFolderPathsOf( entry ) ) {
			vcsPaths.add( vcsPath );
		}

		const extension = forbiddenExtensionOf( entry );

		if ( extension !== null ) {
			forbiddenFiles.set( entry, extension );
		}
	}

	for ( const entry of pluginEntries ) {
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

	for ( const entry of pluginEntries ) {
		if ( TRANSLATION_FILE.test( entry ) ) {
			violations.push(
				`Translation file "${ entry }": WordPress.org serves the plugin's translations from translate.wordpress.org, so the zip must not bundle any. Remove it from the repository.`
			);
		}
	}

	if ( options.variant === 'production' ) {
		for ( const entry of pluginEntries ) {
			if ( DEV_TOOLS_FILE.test( entry ) ) {
				violations.push(
					`Dev-tools file "${ entry }" in the production zip: the production build leaves the dev-tools panel out, so it must not ship.`
				);
			}
		}
	}

	for ( const root of REQUIRED_ROOTS ) {
		if ( ! roots.has( root ) ) {
			violations.push( `Missing required entry "${ root }".` );
		}
	}

	if ( options.variant === 'development' ) {
		for ( const path of DEV_TOOLS_REQUIRED ) {
			if ( ! pluginEntries.includes( path ) ) {
				violations.push(
					`Missing dev-tools file "${ path }": the development build must carry the dev-tools panel.`
				);
			}
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
 * Checks the production zip's scripts for dev-tools code the build should
 * have compiled out. A development zip carries that code on purpose, so it is
 * never checked.
 *
 * @param scripts - The zip's scripts, each with its path inside the plugin folder and its content.
 * @param options - The build variant the zip comes from.
 * @return One message per script that still carries dev-tools code; empty otherwise.
 */
export function findDevToolsCode(
	scripts: readonly PackagedScript[],
	options: PackageRulesOptions
): string[] {
	if ( options.variant !== 'production' ) {
		return [];
	}

	return scripts.flatMap( ( { path, content } ) => {
		const marker = DEV_TOOLS_CODE_MARKERS.find( ( candidate ) =>
			content.includes( candidate )
		);

		return marker === undefined
			? []
			: [
					`Script "${ path }" carries dev-tools code (it contains "${ marker }"): the production build must compile the dev-tools hooks out.`,
			  ];
	} );
}

/**
 * Checks a plugin zip's size against the limit WordPress.org's upload form sets.
 *
 * @param bytes   - The zip's size in bytes.
 * @param options - The build variant the zip comes from: only the production zip is uploaded.
 * @return One message when the production zip reaches the limit; empty otherwise.
 */
export function findSizeViolations(
	bytes: number,
	options: PackageRulesOptions
): string[] {
	if ( options.variant !== 'production' || bytes < MAX_ZIP_BYTES ) {
		return [];
	}

	const megabytes = ( bytes / 1_000_000 ).toFixed( 1 );

	return [
		`Zip is ${ megabytes } MB: WordPress.org's upload form takes zips under 10 MB, so leave out what the plugin doesn't need.`,
	];
}
