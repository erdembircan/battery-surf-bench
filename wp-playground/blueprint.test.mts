/**
 * Tests for the blueprint contract the Playground CLI consumes.
 *
 * These back the dev-server auto-login fix: the dev blueprints must install
 * the custom `bsb-dev-auto-login.php` mu-plugin and must not carry the shared
 * `login` step (whose constant the bundled auto-login mu-plugin reads too late
 * on the pinned CLI version, and whose eventual redirect fights LiveReload).
 * The e2e blueprint is a regression guard: it authenticates through its own
 * `login` step plus `auth.setup.mts`'s form login, and must stay untouched.
 */

import { describe, it, expect } from 'vitest';
import {
	devBlueprint,
	devResumeBlueprint,
	e2eBlueprint,
	autoLoginMuPlugin,
} from './blueprint.mts';

const AUTO_LOGIN_PATH =
	'/wordpress/wp-content/mu-plugins/bsb-dev-auto-login.php';
const LIVE_RELOAD_PATH = '/wordpress/wp-content/mu-plugins/bsb-live-reload.php';

/**
 * Find a `writeFile` step by its target path within a blueprint's steps.
 *
 * @param steps - The blueprint's `steps` array.
 * @param path  - The `writeFile` step's target path to look for.
 * @return The matching step, or undefined if none matches.
 */
function findWriteFileStep(
	steps: ReadonlyArray< Record< string, unknown > > | undefined,
	path: string
) {
	return steps?.find(
		( step ) => step.step === 'writeFile' && step.path === path
	);
}

describe( 'devBlueprint', () => {
	const blueprint = devBlueprint( 9400 );

	it( 'installs the dev auto-login mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			AUTO_LOGIN_PATH
		);

		expect( step ).toBeDefined();
		expect( step?.data ).toContain( 'bsb_dev_auto_login' );
		expect( step?.data ).toContain( 'wp_set_auth_cookie' );
		expect( step?.data ).toContain( 'get_user_by' );
		expect( step?.data ).toContain( "'development'" );
	} );

	it( 'does not include the shared login step', () => {
		expect(
			blueprint.steps?.some(
				( step ) => ( step as { step: string } ).step === 'login'
			)
		).toBe( false );
	} );

	it( 'still installs the LiveReload mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			LIVE_RELOAD_PATH
		);

		expect( step ).toBeDefined();
	} );
} );

describe( 'devResumeBlueprint', () => {
	const blueprint = devResumeBlueprint( 9400 );

	it( 'installs the dev auto-login mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			AUTO_LOGIN_PATH
		);

		expect( step ).toBeDefined();
		expect( step?.data ).toContain( 'bsb_dev_auto_login' );
		expect( step?.data ).toContain( 'wp_set_auth_cookie' );
		expect( step?.data ).toContain( 'get_user_by' );
		expect( step?.data ).toContain( "'development'" );
	} );

	it( 'does not include the shared login step', () => {
		expect(
			blueprint.steps?.some(
				( step ) => ( step as { step: string } ).step === 'login'
			)
		).toBe( false );
	} );

	it( 'still installs the LiveReload mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			LIVE_RELOAD_PATH
		);

		expect( step ).toBeDefined();
	} );
} );

describe( 'e2eBlueprint', () => {
	it( 'still includes the login step authenticating as admin', () => {
		const step = e2eBlueprint.steps?.find(
			( s ) => ( s as { step: string } ).step === 'login'
		) as { step: string; username: string } | undefined;

		expect( step ).toBeDefined();
		expect( step?.username ).toBe( 'admin' );
	} );

	it( 'does not install the dev auto-login mu-plugin', () => {
		const step = findWriteFileStep(
			e2eBlueprint.steps as Record< string, unknown >[],
			AUTO_LOGIN_PATH
		);

		expect( step ).toBeUndefined();
	} );
} );

describe( 'autoLoginMuPlugin', () => {
	it( 'guards on the development environment type', () => {
		expect( autoLoginMuPlugin ).toContain(
			"'development' !== wp_get_environment_type()"
		);
	} );

	it( 'never redirects', () => {
		expect( autoLoginMuPlugin ).not.toContain( 'wp_redirect' );
		expect( autoLoginMuPlugin ).not.toContain( 'wp_safe_redirect' );
	} );
} );
