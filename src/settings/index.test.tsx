/**
 * Behavioral tests for the settings screen entry point.
 *
 * Mirrors `src/sessions/index.test.tsx`: the entry's observable job is a
 * guard — mount the app into the screen's container only when both that
 * container and the localized config are present, and stay inert otherwise.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SettingsConfig } from './Types';

const mounting = vi.hoisted( () => ( {
	createRoot: vi.fn(),
	render: vi.fn(),
	SettingsApp: vi.fn( () => null ),
} ) );

vi.mock( '@wordpress/element', () => ( {
	createRoot: mounting.createRoot,
} ) );

vi.mock( './App', () => ( {
	SettingsApp: mounting.SettingsApp,
} ) );

const config: SettingsConfig = {
	postTypes: [ 'page', 'post' ],
	optionKey: 'bsb_course_order',
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
	delete window.bsbSettings;
} );

describe( 'settings entry point', () => {
	it( 'mounts the app into the container with the localized config', async () => {
		const container = document.createElement( 'div' );
		container.id = 'bsb-settings-app';
		document.body.append( container );
		window.bsbSettings = config;

		await import( './index' );

		expect( mounting.createRoot ).toHaveBeenCalledWith( container );
		const element = mounting.render.mock.calls[ 0 ][ 0 ];
		expect( element.type ).toBe( mounting.SettingsApp );
		expect( element.props.config ).toBe( config );
	} );

	it( 'does nothing when the container is absent', async () => {
		window.bsbSettings = config;

		await import( './index' );

		expect( mounting.createRoot ).not.toHaveBeenCalled();
	} );

	it( 'does nothing when the config was not localized', async () => {
		const container = document.createElement( 'div' );
		container.id = 'bsb-settings-app';
		document.body.append( container );

		await import( './index' );

		expect( mounting.createRoot ).not.toHaveBeenCalled();
	} );
} );
