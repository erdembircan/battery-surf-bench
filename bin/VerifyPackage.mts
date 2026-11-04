/**
 * Verifies a built plugin zip against the package contract in
 * `PackageRules.mts`, the last step of `composer zip:development` and
 * `composer zip:production`.
 *
 * Usage: `pnpm run package:verify -- --development` or `-- --production`. The
 * variant picks the zip (see `PackageLayout.mts`) and the rules: the
 * production zip must leave the dev-tools panel out, its code included, and
 * stay under 10 MB; the development zip must carry the panel. Every violation
 * is listed, and the exit code is non-zero when there is any.
 *
 * Entry names and script contents come from `unzip`, which ships with macOS and
 * the GitHub Actions Ubuntu runners.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { PLUGIN_SLUG, variantFrom, zipFileFor } from './PackageLayout.mts';
import {
	findDevToolsCode,
	findPackageViolations,
	findSizeViolations,
	type PackagedScript,
} from './PackageRules.mts';

/**
 * Reads the production zip's scripts, each with its path inside the plugin
 * folder, so the rules can look for dev-tools code in them.
 *
 * @param zipFile - The zip to read.
 * @param entries - Every entry name in the zip.
 * @return The zip's `.js` files under `build/`, with their contents.
 */
function scriptsIn(
	zipFile: string,
	entries: readonly string[]
): PackagedScript[] {
	const scriptPrefix = `${ PLUGIN_SLUG }/build/`;

	return entries
		.filter(
			( entry ) =>
				entry.startsWith( scriptPrefix ) && entry.endsWith( '.js' )
		)
		.map( ( entry ) => ( {
			path: entry.slice( PLUGIN_SLUG.length + 1 ),
			content: execFileSync( 'unzip', [ '-p', zipFile, entry ], {
				encoding: 'utf8',
				maxBuffer: 64 * 1024 * 1024,
			} ),
		} ) );
}

/**
 * Checks the zip of the variant named on the command line and reports the result.
 *
 * @param args - The command-line arguments after the script path.
 * @return The process exit code: 0 when the zip is clean, 1 when it breaks the contract or is missing, 2 on bad usage.
 */
function main( args: readonly string[] ): number {
	const variant = variantFrom( args );

	if ( variant === null ) {
		process.stderr.write(
			'Usage: pnpm run package:verify -- --development | --production\n'
		);

		return 2;
	}

	const zipFile = zipFileFor( variant );

	if ( ! existsSync( zipFile ) ) {
		process.stderr.write(
			`✗ No zip at ${ zipFile }: run composer zip:${ variant }, which builds and zips it.\n`
		);

		return 1;
	}

	const entries = execFileSync( 'unzip', [ '-Z1', zipFile ], {
		encoding: 'utf8',
	} )
		.split( '\n' )
		.filter( ( entry ) => entry !== '' );

	const options = { variant };
	const violations = [
		...findPackageViolations( entries, options ),
		...findSizeViolations( statSync( zipFile ).size, options ),
		...findDevToolsCode(
			variant === 'production' ? scriptsIn( zipFile, entries ) : [],
			options
		),
	];

	if ( violations.length > 0 ) {
		const list = violations
			.map( ( violation ) => `  - ${ violation }\n` )
			.join( '' );

		process.stderr.write(
			`✗ ${ zipFile } breaks the package contract:\n${ list }`
		);

		return 1;
	}

	process.stdout.write(
		`✓ ${ zipFile } passes the package contract (${ entries.length } entries).\n`
	);

	return 0;
}

process.exitCode = main( process.argv.slice( 2 ) );
