/**
 * Verifies the Live Preview blueprint in `.wordpress-org/blueprints/`, which the
 * deploy copies to the plugin's SVN `assets/` for WordPress.org's Live Preview
 * button. A blueprint WordPress.org can't use quietly removes that button, so
 * this check fails the build instead. See "Releases" in `CLAUDE.md`.
 *
 * Usage: `pnpm blueprint:verify`. Every problem is listed, and the exit code is
 * non-zero when there is any.
 */

import { existsSync, readFileSync } from 'node:fs';
import { PLUGIN_SLUG } from '../wp-playground/config.mts';
import { findBlueprintErrors } from './LivePreviewBlueprint.mts';

/** Where the Live Preview blueprint lives, relative to the repository root. */
const BLUEPRINT_PATH = '.wordpress-org/blueprints/blueprint.json';

/**
 * Checks the blueprint and reports the result.
 *
 * @return The process exit code: 0 when the blueprint is valid, 1 when it is not, 2 when there is no blueprint.
 */
function main(): number {
	if ( ! existsSync( BLUEPRINT_PATH ) ) {
		process.stderr.write(
			`No Live Preview blueprint found at ${ BLUEPRINT_PATH }.\n`
		);

		return 2;
	}

	const problems = findBlueprintErrors(
		readFileSync( BLUEPRINT_PATH, 'utf8' ),
		PLUGIN_SLUG
	);

	if ( problems.length > 0 ) {
		process.stderr.write(
			`✗ ${ BLUEPRINT_PATH } is not a valid Live Preview blueprint:\n`
		);

		for ( const problem of problems ) {
			process.stderr.write( `    ${ problem }\n` );
		}

		return 1;
	}

	process.stdout.write(
		`✓ ${ BLUEPRINT_PATH } is a valid Live Preview blueprint.\n`
	);

	return 0;
}

process.exitCode = main();
