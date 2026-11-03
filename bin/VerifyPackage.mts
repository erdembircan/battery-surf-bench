/**
 * Verifies a built plugin zip against the package contract in
 * `PackageRules.mts`, so nothing outside the plugin's own files reaches
 * WordPress.org.
 *
 * Usage: `tsx bin/VerifyPackage.mts <zip> [--release]`, or
 * `pnpm package:verify [--release]` for the default `composer zip` output.
 * `--release` also requires the compiled `build/` bundles and the production
 * `vendor/` tree that `bin/Release.sh` produces. Every violation is listed, and
 * the exit code is non-zero when there is any.
 *
 * Entry names come from `unzip -Z1`, which ships with macOS and the GitHub
 * Actions Ubuntu runners.
 */

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { findPackageViolations, findSizeViolations } from './PackageRules.mts';

/**
 * Checks the zip named on the command line and reports the result.
 *
 * @param args - The command-line arguments after the script path.
 * @return The process exit code: 0 when the zip is clean, 1 when it breaks the contract, 2 on bad usage.
 */
function main( args: readonly string[] ): number {
	const zipPath = args.find( ( arg ) => ! arg.startsWith( '--' ) );

	if ( zipPath === undefined ) {
		process.stderr.write(
			'Usage: tsx bin/VerifyPackage.mts <zip> [--release]\n'
		);

		return 2;
	}

	const entries = execFileSync( 'unzip', [ '-Z1', zipPath ], {
		encoding: 'utf8',
	} )
		.split( '\n' )
		.filter( ( entry ) => entry !== '' );

	const release = args.includes( '--release' );
	const violations = [
		...findPackageViolations( entries, { release } ),
		...findSizeViolations( statSync( zipPath ).size, { release } ),
	];

	if ( violations.length > 0 ) {
		const list = violations
			.map( ( violation ) => `  - ${ violation }\n` )
			.join( '' );

		process.stderr.write(
			`✗ ${ zipPath } breaks the package contract:\n${ list }`
		);

		return 1;
	}

	process.stdout.write(
		`✓ ${ zipPath } passes the package contract (${ entries.length } entries).\n`
	);

	return 0;
}

process.exitCode = main( process.argv.slice( 2 ) );
