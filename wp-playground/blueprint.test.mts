/**
 * Tests for the blueprint contract the Playground CLI consumes.
 *
 * These back the dev-server auto-login fix: the dev blueprints must install
 * the custom `bsb-dev-auto-login.php` mu-plugin and must not carry the shared
 * `login` step (whose constant the bundled auto-login mu-plugin reads too late
 * on the pinned CLI version, and whose eventual redirect fights LiveReload).
 * The e2e blueprint is a regression guard: it authenticates through its own
 * `login` step plus `auth.setup.mts`'s form login, and must stay untouched.
 *
 * The unauthenticated e2e blueprint backs the login-free test server the
 * `unauthenticated` Playwright project targets: it must still activate the
 * plugin and enable debug constants, but must never carry the `login` step or
 * the dev auto-login mu-plugin, or a fresh browser context there would stop
 * being genuinely anonymous.
 */

import { describe, it, expect } from 'vitest';
import type {
	BlueprintDeclaration,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import {
	devBlueprint,
	devResumeBlueprint,
	e2eBlueprint,
	e2eUnauthenticatedBlueprint,
	autoLoginMuPlugin,
} from './blueprint.mts';

/**
 * All blueprints this module builds are Blueprint v1 declarations (the v2
 * format is unused here); narrow the exported `BlueprintDeclaration` union so
 * tests can read `.steps` directly instead of asserting on the raw union type.
 *
 * @param declaration - A blueprint declaration produced by this module.
 * @return The same declaration, typed as a v1 declaration.
 */
function asV1( declaration: BlueprintDeclaration ): BlueprintV1Declaration {
	return declaration as BlueprintV1Declaration;
}

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
	const blueprint = asV1( devBlueprint( 9400 ) );

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
	const blueprint = asV1( devResumeBlueprint( 9400 ) );

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
	const blueprint = asV1( e2eBlueprint );

	it( 'still includes the login step authenticating as admin', () => {
		const step = blueprint.steps?.find(
			( s ) => ( s as { step: string } ).step === 'login'
		) as { step: string; username: string } | undefined;

		expect( step ).toBeDefined();
		expect( step?.username ).toBe( 'admin' );
	} );

	it( 'does not install the dev auto-login mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			AUTO_LOGIN_PATH
		);

		expect( step ).toBeUndefined();
	} );
} );

describe( 'e2eUnauthenticatedBlueprint', () => {
	const blueprint = asV1( e2eUnauthenticatedBlueprint );

	it( 'activates the plugin', () => {
		expect(
			blueprint.steps?.some(
				( step ) =>
					( step as { step: string } ).step === 'activatePlugin'
			)
		).toBe( true );
	} );

	it( 'defines the debug wp-config consts', () => {
		expect(
			blueprint.steps?.some(
				( step ) =>
					( step as { step: string } ).step === 'defineWpConfigConsts'
			)
		).toBe( true );
	} );

	it( 'does not include the login step -- the core behavioral guarantee that keeps a fresh browser context logged out', () => {
		expect(
			blueprint.steps?.some(
				( step ) => ( step as { step: string } ).step === 'login'
			)
		).toBe( false );
	} );

	it( 'does not install the dev auto-login mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
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
