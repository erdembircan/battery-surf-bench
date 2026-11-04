/**
 * Zips the assembled plugin folder, the step after the build in
 * `composer zip:development` and `composer zip:production`.
 *
 * Compresses `dist/battery-surf-bench/` into `zip/battery-surf-bench.zip`, or
 * `zip/battery-surf-bench-development.zip` for the development build, with
 * every file under that one top-level folder, so a manual install puts the
 * plugin in `wp-content/plugins/battery-surf-bench/`. It only compresses: the
 * build has already decided what the folder holds.
 *
 * Usage: `pnpm run package:zip -- --development` or `-- --production`. Zips
 * with `zip`, which ships with macOS and the GitHub Actions Ubuntu runners.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
	DIST_DIR,
	PLUGIN_DIR,
	PLUGIN_SLUG,
	variantFrom,
	zipFileFor,
} from './PackageLayout.mts';

/**
 * Zips the plugin folder for the variant named on the command line.
 *
 * @param args - The command-line arguments after the script path.
 * @return The process exit code: 0 once the zip is written, 1 when there is no plugin folder to zip, 2 on bad usage.
 */
function main( args: readonly string[] ): number {
	const variant = variantFrom( args );

	if ( variant === null ) {
		process.stderr.write(
			'Usage: pnpm run package:zip -- --development | --production\n'
		);

		return 2;
	}

	if ( ! existsSync( PLUGIN_DIR ) ) {
		process.stderr.write(
			`✗ No plugin folder at ${ PLUGIN_DIR }: run composer build:${ variant } first.\n`
		);

		return 1;
	}

	const zipFile = resolve( zipFileFor( variant ) );

	// zip adds to an existing archive instead of replacing it, so remove the
	// old one first, or files deleted since the last build would still ship.
	mkdirSync( dirname( zipFile ), { recursive: true } );
	rmSync( zipFile, { force: true } );

	// -D leaves out folder entries and -X Unix file attributes such as the owner.
	execFileSync( 'zip', [ '-qrXD', zipFile, PLUGIN_SLUG ], {
		cwd: DIST_DIR,
	} );

	process.stdout.write(
		`✓ Zipped the ${ variant } plugin into ${ zipFileFor( variant ) }.\n`
	);

	return 0;
}

process.exitCode = main( process.argv.slice( 2 ) );
