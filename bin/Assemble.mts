/**
 * Assembles the plugin folder a site installs, the last step of
 * `composer build:development` and `composer build:production`.
 *
 * Unpacks the archive the `archive:plugin` Composer script wrote (the files
 * `.gitattributes` lets through, with the compiled `build/` and the production
 * `vendor/`) into `dist/battery-surf-bench/`, then deletes the archive. The
 * production variant also leaves out the dev-tools panel's PHP: PHP isn't
 * compiled, so assembling the folder is where the production build drops it.
 * The panel's script and stylesheet never reach a production build at all.
 *
 * Usage: `pnpm run assemble -- --development` or `-- --production`. Unpacks
 * with `unzip`, which ships with macOS and the GitHub Actions Ubuntu runners.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import {
	ARCHIVE_FILE,
	DEV_TOOLS_SOURCE,
	PLUGIN_DIR,
	variantFrom,
} from './PackageLayout.mts';

/**
 * Assembles the plugin folder for the variant named on the command line.
 *
 * @param args - The command-line arguments after the script path.
 * @return The process exit code: 0 once the folder is assembled, 1 when there is no archive to assemble from, 2 on bad usage.
 */
function main( args: readonly string[] ): number {
	const variant = variantFrom( args );

	if ( variant === null ) {
		process.stderr.write(
			'Usage: pnpm run assemble -- --development | --production\n'
		);

		return 2;
	}

	if ( ! existsSync( ARCHIVE_FILE ) ) {
		process.stderr.write(
			`✗ No archive at ${ ARCHIVE_FILE }: run composer build:${ variant }, which writes it first.\n`
		);

		return 1;
	}

	rmSync( PLUGIN_DIR, { recursive: true, force: true } );
	execFileSync( 'unzip', [ '-q', ARCHIVE_FILE, '-d', PLUGIN_DIR ] );
	rmSync( ARCHIVE_FILE );

	if ( variant === 'production' ) {
		rmSync( `${ PLUGIN_DIR }/${ DEV_TOOLS_SOURCE }`, {
			recursive: true,
			force: true,
		} );
	}

	process.stdout.write(
		`✓ Assembled the ${ variant } plugin in ${ PLUGIN_DIR }/.\n`
	);

	return 0;
}

process.exitCode = main( process.argv.slice( 2 ) );
