/**
 * Behavioral tests for the settings screen entry point.
 *
 * Mirrors `src/sessions/index.test.tsx`: the entry's observable job is a
 * guard — mount the app into the screen's container only when both that
 * container and the localized config are present, and stay inert otherwise.
 * When it does mount, the app is wrapped in the shared `ErrorBoundary`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SettingsConfig } from '@/settings/Types';

const mounting = vi.hoisted( () => ( {
	createRoot: vi.fn(),
	render: vi.fn(),
	SettingsApp: vi.fn( () => null ),
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

vi.mock( '@/settings/App', () => ( {
	SettingsApp: mounting.SettingsApp,
} ) );

const config: SettingsConfig = {
	postTypes: [ 'page', 'post' ],
	optionKey: 'bsbench_course_order',
	courseOrder: [],
	bundledCatalog: [],
	initialBrowse: { records: [], totalItems: 0, totalPages: 1 },
	userPages: {},
};

beforeEach( () => {
	mounting.createRoot.mockReturnValue( { render: mounting.render } );
	vi.resetModules();
} );

afterEach( () => {
	document.body.innerHTML = '';
	delete window.bsbenchSettings;
} );

describe( 'settings entry point', () => {
	it( 'mounts the app into the container with the localized config', async () => {
		const container = document.createElement( 'div' );
		container.id = 'bsb-settings-app';
		document.body.append( container );
		window.bsbenchSettings = config;

		await import( '@/settings/index' );

		expect( mounting.createRoot ).toHaveBeenCalledWith( container );
		const element = mounting.render.mock.calls[ 0 ][ 0 ];
		expect( element.type ).toBe( mounting.ErrorBoundary );
		const app = element.props.children;
		expect( app.type ).toBe( mounting.SettingsApp );
		expect( app.props.config ).toBe( config );
	} );

	it( 'does nothing when the container is absent', async () => {
		window.bsbenchSettings = config;

		await import( '@/settings/index' );

		expect( mounting.createRoot ).not.toHaveBeenCalled();
	} );

	it( 'does nothing when the config was not localized', async () => {
		const container = document.createElement( 'div' );
		container.id = 'bsb-settings-app';
		document.body.append( container );

		await import( '@/settings/index' );

		expect( mounting.createRoot ).not.toHaveBeenCalled();
	} );
} );
