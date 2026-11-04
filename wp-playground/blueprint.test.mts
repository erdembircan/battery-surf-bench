/**
 * Tests for the blueprint contract the Playground CLI consumes.
 *
 * These back the dev-server auto-login fix: the dev blueprints must install
 * the custom `bsb-dev-auto-login.php` mu-plugin and must not carry the shared
 * `login` step (whose constant the bundled auto-login mu-plugin reads too late
 * on the pinned CLI version, and whose eventual redirect fights LiveReload).
 * The e2e blueprint is a regression guard too: that same CLI-version race also
 * made the `login` step's bundled auto-login mu-plugin race the server's ready
 * flag against a cookie-less `wp-login.php` request, so it must never carry
 * that step either — `auth.setup.mts`'s own form login plus the `storageState`
 * it persists are the only source of authentication for the `authenticated`
 * project.
 *
 * The unauthenticated e2e blueprint backs the login-free test server the
 * `unauthenticated` Playwright project targets: it must still activate the
 * plugin and enable debug constants, but must never carry the `login` step or
 * the dev auto-login mu-plugin, or a fresh browser context there would stop
 * being genuinely anonymous.
 *
 * The dev blueprints also reset the site language to English on every boot:
 * the language lives in the persisted database, so a switch made to check a
 * translation used to stick across restarts. The e2e blueprints leave it
 * alone, since they start from a fresh English install on every run.
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
	screenshotsBlueprint,
	productionBlueprint,
	autoLoginMuPlugin,
	youtubeOembedStubMuPlugin,
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
const YOUTUBE_OEMBED_STUB_PATH =
	'/wordpress/wp-content/mu-plugins/bsb-youtube-oembed-stub.php';

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

/**
 * Read the value a blueprint's `setSiteOptions` steps give a site option.
 *
 * @param steps - The blueprint's `steps` array.
 * @param name  - The option to look up.
 * @return The option's value, or undefined if no step sets it.
 */
function findSiteOption(
	steps: ReadonlyArray< Record< string, unknown > > | undefined,
	name: string
): unknown {
	const step = steps?.find(
		( candidate ) =>
			candidate.step === 'setSiteOptions' &&
			name in ( candidate.options as Record< string, unknown > )
	);

	return ( step?.options as Record< string, unknown > | undefined )?.[ name ];
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

	it( 'installs the YouTube oEmbed stub mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			YOUTUBE_OEMBED_STUB_PATH
		);

		expect( step ).toBeDefined();
		expect( step?.data ).toContain( 'bsb_youtube_oembed_stub' );
		expect( step?.data ).toContain( 'pre_oembed_result' );
	} );

	it( 'resets the site language to English', () => {
		expect(
			findSiteOption(
				blueprint.steps as Record< string, unknown >[],
				'WPLANG'
			)
		).toBe( '' );
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

	it( 'installs the YouTube oEmbed stub mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			YOUTUBE_OEMBED_STUB_PATH
		);

		expect( step ).toBeDefined();
	} );

	it( 'resets the site language to English', () => {
		expect(
			findSiteOption(
				blueprint.steps as Record< string, unknown >[],
				'WPLANG'
			)
		).toBe( '' );
	} );
} );

describe( 'e2eBlueprint', () => {
	const blueprint = asV1( e2eBlueprint );

	it( 'does not include the login step -- auth.setup.mts drives a real form login instead, whose storageState the authenticated project reuses', () => {
		expect(
			blueprint.steps?.some(
				( step ) => ( step as { step: string } ).step === 'login'
			)
		).toBe( false );
	} );

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

	it( 'does not install the dev auto-login mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			AUTO_LOGIN_PATH
		);

		expect( step ).toBeUndefined();
	} );

	it( 'installs the YouTube oEmbed stub mu-plugin', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			YOUTUBE_OEMBED_STUB_PATH
		);

		expect( step ).toBeDefined();
	} );

	it( 'does not set the site language -- a fresh install is already English', () => {
		expect(
			findSiteOption(
				blueprint.steps as Record< string, unknown >[],
				'WPLANG'
			)
		).toBeUndefined();
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

	it( 'does not install the YouTube oEmbed stub mu-plugin -- no unauthenticated spec touches video content', () => {
		const step = findWriteFileStep(
			blueprint.steps as Record< string, unknown >[],
			YOUTUBE_OEMBED_STUB_PATH
		);

		expect( step ).toBeUndefined();
	} );

	it( 'does not set the site language -- a fresh install is already English', () => {
		expect(
			findSiteOption(
				blueprint.steps as Record< string, unknown >[],
				'WPLANG'
			)
		).toBeUndefined();
	} );
} );

describe( 'screenshotsBlueprint', () => {
	const blueprint = asV1( screenshotsBlueprint );
	const steps = blueprint.steps as Record< string, unknown >[];

	/**
	 * Read the wp-config constants the blueprint defines.
	 *
	 * @return The constants map, or undefined if no step defines any.
	 */
	function definedConsts(): Record< string, unknown > | undefined {
		return steps.find( ( step ) => step.step === 'defineWpConfigConsts' )
			?.consts as Record< string, unknown > | undefined;
	}

	it( 'sets the production environment type, so the dev-tools panel stays closed', () => {
		expect( definedConsts()?.WP_ENVIRONMENT_TYPE ).toBe( 'production' );
	} );

	it( 'turns debugging and debug output off', () => {
		expect( definedConsts()?.WP_DEBUG ).toBe( false );
		expect( definedConsts()?.WP_DEBUG_DISPLAY ).toBe( false );
	} );

	it( 'names the site Coastline Tech Notes', () => {
		expect( findSiteOption( steps, 'blogname' ) ).toBe(
			'Coastline Tech Notes'
		);
	} );

	it( 'turns off the admin\'s "Show Toolbar when viewing site" preference, so the surfed pages show no toolbar', () => {
		const step = steps.find(
			( { step: name } ) => name === 'updateUserMeta'
		);

		expect( step?.userId ).toBe( 1 );
		expect( step?.meta ).toEqual( { show_admin_bar_front: 'false' } );
	} );

	it( 'activates the plugin', () => {
		expect( steps.some( ( step ) => step.step === 'activatePlugin' ) ).toBe(
			true
		);
	} );

	it( 'installs the YouTube oEmbed stub mu-plugin', () => {
		expect(
			findWriteFileStep( steps, YOUTUBE_OEMBED_STUB_PATH )
		).toBeDefined();
	} );

	it( 'installs neither the dev auto-login nor the LiveReload mu-plugin', () => {
		expect( findWriteFileStep( steps, AUTO_LOGIN_PATH ) ).toBeUndefined();
		expect( findWriteFileStep( steps, LIVE_RELOAD_PATH ) ).toBeUndefined();
	} );

	it( 'does not include the login step -- the screenshot run logs in through the form', () => {
		expect( steps.some( ( step ) => step.step === 'login' ) ).toBe( false );
	} );
} );

describe( 'productionBlueprint', () => {
	const blueprint = asV1( productionBlueprint );
	const steps = blueprint.steps as Record< string, unknown >[];

	/**
	 * Read the wp-config constants the blueprint defines.
	 *
	 * @return The constants map, or undefined if no step defines any.
	 */
	function definedConsts(): Record< string, unknown > | undefined {
		return steps.find( ( step ) => step.step === 'defineWpConfigConsts' )
			?.consts as Record< string, unknown > | undefined;
	}

	it( 'sets the production environment type, like a real install', () => {
		expect( definedConsts()?.WP_ENVIRONMENT_TYPE ).toBe( 'production' );
	} );

	it( 'turns debugging and debug output off', () => {
		expect( definedConsts()?.WP_DEBUG ).toBe( false );
		expect( definedConsts()?.WP_DEBUG_DISPLAY ).toBe( false );
	} );

	it( 'activates the plugin', () => {
		expect( steps.some( ( step ) => step.step === 'activatePlugin' ) ).toBe(
			true
		);
	} );

	it( 'installs the YouTube oEmbed stub mu-plugin', () => {
		expect(
			findWriteFileStep( steps, YOUTUBE_OEMBED_STUB_PATH )
		).toBeDefined();
	} );

	it( 'installs the auto-login mu-plugin and opts in to it, so the browser lands signed in', () => {
		expect( findWriteFileStep( steps, AUTO_LOGIN_PATH ) ).toBeDefined();
		expect(
			steps.some(
				( step ) =>
					step.step === 'defineWpConfigConsts' &&
					( step.consts as Record< string, unknown > )
						.BSB_PLAYGROUND_AUTO_LOGIN === true
			)
		).toBe( true );
	} );

	it( 'does not install the LiveReload mu-plugin', () => {
		expect( findWriteFileStep( steps, LIVE_RELOAD_PATH ) ).toBeUndefined();
	} );

	it( 'does not include the shared login step -- the auto-login mu-plugin signs the browser in instead', () => {
		expect( steps.some( ( step ) => step.step === 'login' ) ).toBe( false );
	} );
} );

describe( 'autoLoginMuPlugin', () => {
	it( 'guards on the development environment type', () => {
		expect( autoLoginMuPlugin ).toContain(
			"'development' !== wp_get_environment_type()"
		);
	} );

	it( 'also acts where the blueprint opts in with BSB_PLAYGROUND_AUTO_LOGIN', () => {
		expect( autoLoginMuPlugin ).toContain(
			"defined( 'BSB_PLAYGROUND_AUTO_LOGIN' ) && BSB_PLAYGROUND_AUTO_LOGIN"
		);
	} );

	it( 'never redirects', () => {
		expect( autoLoginMuPlugin ).not.toContain( 'wp_redirect' );
		expect( autoLoginMuPlugin ).not.toContain( 'wp_safe_redirect' );
	} );
} );

describe( 'youtubeOembedStubMuPlugin', () => {
	it( 'hooks pre_oembed_result', () => {
		expect( youtubeOembedStubMuPlugin ).toContain(
			"add_filter( 'pre_oembed_result', 'bsb_youtube_oembed_stub', 10, 2 );"
		);
	} );

	it( 'returns a youtube.com/embed iframe carrying the requested video id', () => {
		expect( youtubeOembedStubMuPlugin ).toContain(
			'https://www.youtube.com/embed/'
		);
		expect( youtubeOembedStubMuPlugin ).toContain( '$matches[1]' );
	} );

	it( 'never makes a network request of its own', () => {
		expect( youtubeOembedStubMuPlugin ).not.toContain( 'wp_remote_get' );
		expect( youtubeOembedStubMuPlugin ).not.toContain( 'curl' );
	} );
} );
