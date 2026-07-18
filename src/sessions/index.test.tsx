/**
 * Behavioral tests for the sessions screen entry point.
 *
 * The entry's observable job is a guard: mount the app into the screen's
 * container only when both that container and the localized config are present,
 * and stay inert otherwise (so the bundle loading on an unrelated admin page
 * does nothing). These tests drive that guard through the DOM and the global
 * the PHP screen localizes, asserting whether a root is created and what it is
 * told to render — never how the module stores anything internally. When it
 * does mount, the app is wrapped in the shared `ErrorBoundary`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mounting = vi.hoisted( () => ( {
	createRoot: vi.fn(),
	render: vi.fn(),
	SessionsApp: vi.fn( () => null ),
	// A stub standing in for the real `ErrorBoundary` — its own crash-fallback
	// behavior is covered by `src/shared/ErrorBoundary.test.tsx`; this entry
	// point's own contract is only that it wraps the mounted app in it.
	ErrorBoundary: vi.fn( ( { children } ) => children ),
} ) );

vi.mock( '@wordpress/element', () => ( {
	createRoot: mounting.createRoot,
} ) );

vi.mock( '@/shared/ErrorBoundary', () => ( {
	ErrorBoundary: mounting.ErrorBoundary,
} ) );

vi.mock( '@/sessions/App', () => ( {
	SessionsApp: mounting.SessionsApp,
} ) );

const config = {
	postType: 'bsb_session',
	fields: [],
	defaultColumns: [],
};

beforeEach( () => {
	mounting.createRoot.mockReturnValue( { render: mounting.render } );
	vi.resetModules();
} );

afterEach( () => {
	document.body.innerHTML = '';
	delete window.bsbSessions;
} );

describe( 'sessions entry point', () => {
	it( 'mounts the app into the container with the localized config', async () => {
		const container = document.createElement( 'div' );
		container.id = 'bsb-sessions-app';
		document.body.append( container );
		window.bsbSessions = config;

		await import( '@/sessions/index' );

		expect( mounting.createRoot ).toHaveBeenCalledWith( container );
		const element = mounting.render.mock.calls[ 0 ][ 0 ];
		expect( element.type ).toBe( mounting.ErrorBoundary );
		const app = element.props.children;
		expect( app.type ).toBe( mounting.SessionsApp );
		expect( app.props.config ).toBe( config );
	} );

	it( 'does nothing when the container is absent', async () => {
		window.bsbSessions = config;

		await import( '@/sessions/index' );

		expect( mounting.createRoot ).not.toHaveBeenCalled();
	} );

	it( 'does nothing when the config was not localized', async () => {
		const container = document.createElement( 'div' );
		container.id = 'bsb-sessions-app';
		document.body.append( container );

		await import( '@/sessions/index' );

		expect( mounting.createRoot ).not.toHaveBeenCalled();
	} );
} );
