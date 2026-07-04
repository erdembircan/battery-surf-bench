/**
 * Tests for the floating dev-tools panel: a vanilla-DOM component, so these
 * drive it through the DOM (jsdom) rather than mocking the Interactivity
 * runtime. Covers mounting, expand/collapse, the bypass toggle's effects
 * (state, persistence, forcing an immediate reading), and restoring persisted
 * state on a fresh mount.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountDevToolsPanel } from './DevToolsPanel';
import { devOverrides, applyDevOverrides } from './DevOverrides';
import { instanceFor, __resetInstance } from './RunInstance';
import { type BatteryMonitor } from './BatteryMonitor';

const STORAGE_KEY = 'bsb-dev-tools';

/** A fake monitor exposing only what the panel calls. */
const fakeMonitor = (): BatteryMonitor =>
	( { refresh: vi.fn() } ) as unknown as BatteryMonitor;

beforeEach( () => {
	document.body.innerHTML = '';
	window.localStorage.clear();
	__resetInstance();
	devOverrides.bypassCharging = false;
	devOverrides.actualCharging = null;
} );

describe( 'mountDevToolsPanel', () => {
	it( 'renders the chip into the host, collapsed by default', () => {
		const host = document.createElement( 'div' );
		document.body.appendChild( host );

		mountDevToolsPanel( host );

		const panel = host.querySelector( '.bsb-devtools' );
		expect( panel ).not.toBeNull();
		expect( panel!.getAttribute( 'data-collapsed' ) ).toBe( 'true' );
		expect( host.querySelector( '.bsb-devtools__chip' ) ).not.toBeNull();
	} );

	it( 'round-trips expand and collapse', () => {
		const host = document.createElement( 'div' );
		mountDevToolsPanel( host );
		const panel = host.querySelector< HTMLElement >( '.bsb-devtools' )!;
		const chip = host.querySelector< HTMLButtonElement >(
			'.bsb-devtools__chip'
		)!;
		const collapse = host.querySelector< HTMLButtonElement >(
			'.bsb-devtools__collapse'
		)!;

		chip.click();
		expect( panel.dataset.collapsed ).toBe( 'false' );

		collapse.click();
		expect( panel.dataset.collapsed ).toBe( 'true' );
	} );

	it( 'flips devOverrides.bypassCharging, persists it, and refreshes the monitor', () => {
		const monitor = fakeMonitor();
		instanceFor().monitor = monitor;

		const host = document.createElement( 'div' );
		mountDevToolsPanel( host );
		const bypass = host.querySelector< HTMLInputElement >(
			'.bsb-devtools__bypass'
		)!;

		bypass.checked = true;
		bypass.dispatchEvent( new Event( 'change' ) );

		expect( devOverrides.bypassCharging ).toBe( true );
		expect( monitor.refresh ).toHaveBeenCalledTimes( 1 );

		const stored = JSON.parse(
			window.localStorage.getItem( STORAGE_KEY )!
		);
		expect( stored.bypassCharging ).toBe( true );
	} );

	it( 'shows the actual-state line only while bypassing, and reflects the raw truth', () => {
		const host = document.createElement( 'div' );
		mountDevToolsPanel( host );
		const bypass = host.querySelector< HTMLInputElement >(
			'.bsb-devtools__bypass'
		)!;
		const actual = host.querySelector< HTMLElement >(
			'.bsb-devtools__actual'
		)!;
		const actualState = host.querySelector< HTMLElement >(
			'.bsb-devtools__actual-state'
		)!;

		expect( actual.dataset.visible ).toBe( 'false' );

		bypass.checked = true;
		bypass.dispatchEvent( new Event( 'change' ) );
		expect( actual.dataset.visible ).toBe( 'true' );

		// A transformed reading (the panel subscribed via onDevReading) updates
		// the actual-state line to the raw truth it recorded.
		applyDevOverrides( { level: 0.5, charging: true } );

		expect( actualState.textContent ).toBe( 'plugged in' );
	} );

	it( 'restores persisted state on mount and tolerates a corrupt payload', () => {
		window.localStorage.setItem( STORAGE_KEY, 'not json' );

		const host = document.createElement( 'div' );
		expect( () => mountDevToolsPanel( host ) ).not.toThrow();

		const panel = host.querySelector< HTMLElement >( '.bsb-devtools' )!;
		expect( panel.dataset.collapsed ).toBe( 'true' );
		expect( devOverrides.bypassCharging ).toBe( false );
	} );

	it( 'restores an active bypass expanded and refreshes the monitor', () => {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify( { collapsed: false, bypassCharging: true } )
		);
		const monitor = fakeMonitor();
		instanceFor().monitor = monitor;

		const host = document.createElement( 'div' );
		mountDevToolsPanel( host );

		const panel = host.querySelector< HTMLElement >( '.bsb-devtools' )!;
		expect( panel.dataset.collapsed ).toBe( 'false' );
		expect( devOverrides.bypassCharging ).toBe( true );
		expect( monitor.refresh ).toHaveBeenCalledTimes( 1 );
	} );
} );
