/**
 * Checks that a release's versions agree before it is deployed to WordPress.org,
 * with the rules in `ReleaseVersion.mts`.
 *
 * Usage: `pnpm release:version [tag]` compares the plugin header's `Version:`,
 * `readme.txt`'s `Stable tag:` and, when given, the git tag. It prints the
 * version on standard output when they agree, for the deploy workflow to pass
 * on, and exits non-zero with every problem on standard error when they don't.
 */

import { readFileSync } from 'node:fs';
import { findReleaseVersion } from './ReleaseVersion.mts';

/** The main plugin file, which carries the plugin header. */
const PLUGIN_FILE = 'battery-surf-bench.php';

/** The readme WordPress.org builds the plugin page from. */
const README = 'readme.txt';

/**
 * Checks the versions and reports the result.
 *
 * @param args - The command-line arguments after the script path: the optional tag.
 * @return The process exit code: 0 when the versions agree, 1 when they don't.
 */
function main( args: readonly string[] ): number {
	const tag = args[ 0 ] ?? null;
	const result = findReleaseVersion(
		readFileSync( PLUGIN_FILE, 'utf8' ),
		readFileSync( README, 'utf8' ),
		tag
	);

	if ( 'errors' in result ) {
		for ( const error of result.errors ) {
			process.stderr.write( `✗ ${ error }\n` );
		}

		return 1;
	}

	process.stdout.write( `${ result.version }\n` );

	return 0;
}

process.exitCode = main( process.argv.slice( 2 ) );
