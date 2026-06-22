/**
 * Tests for the target-drop slider math.
 *
 * The consumer is the store, which maps pointer/keyboard input to a stepped,
 * capped target percentage and colours the fill. These tests verify the
 * stepping, the cap at the current battery level, the pointer mapping and the
 * colour ramp.
 */

import { describe, it, expect } from 'vitest';
import {
	targetCap,
	clampTarget,
	targetFromPointer,
	targetColor,
	TARGET_MAX,
} from './TargetControl';

describe( 'targetCap', () => {
	it( 'falls back to the nominal max until the level is known', () => {
		expect( targetCap( null ) ).toBe( TARGET_MAX );
	} );

	it( 'caps at the largest step strictly below the current level', () => {
		expect( targetCap( 84 ) ).toBe( 80 );
		// A level already on the grid can't be targeted (that's a zero drop).
		expect( targetCap( 90 ) ).toBe( 85 );
		expect( targetCap( 65 ) ).toBe( 60 );
	} );

	it( 'never drops below the minimum', () => {
		expect( targetCap( 2 ) ).toBe( 5 );
	} );
} );

describe( 'clampTarget', () => {
	it( 'snaps to the step and clamps to the range', () => {
		expect( clampTarget( 42 ) ).toBe( 40 );
		expect( clampTarget( 43 ) ).toBe( 45 );
		expect( clampTarget( -10 ) ).toBe( 5 );
		expect( clampTarget( 200 ) ).toBe( TARGET_MAX );
	} );

	it( 'honours a lower cap', () => {
		expect( clampTarget( 95, 80 ) ).toBe( 80 );
	} );
} );

describe( 'targetFromPointer', () => {
	/** A 100px-wide track starting at x=0. */
	const track = {
		getBoundingClientRect: () => ( { left: 0, width: 100 } ),
	} as unknown as HTMLElement;

	it( 'maps the pointer x across the track to a stepped percentage', () => {
		expect( targetFromPointer( 40, track, TARGET_MAX ) ).toBe( 40 );
		expect( targetFromPointer( 100, track, TARGET_MAX ) ).toBe(
			TARGET_MAX
		);
		expect( targetFromPointer( -20, track, TARGET_MAX ) ).toBe( 5 );
	} );

	it( 'respects the cap at the top of the track', () => {
		expect( targetFromPointer( 100, track, 80 ) ).toBe( 80 );
	} );

	it( 'is safe on a zero-width track', () => {
		const collapsed = {
			getBoundingClientRect: () => ( { left: 0, width: 0 } ),
		} as unknown as HTMLElement;

		expect( targetFromPointer( 40, collapsed, TARGET_MAX ) ).toBe( 5 );
	} );
} );

describe( 'targetColor', () => {
	it( 'grades from green at high levels to red at low ones', () => {
		expect( targetColor( 90 ) ).toBe( 'hsl(108, 72%, 45%)' );
		expect( targetColor( 10 ) ).toBe( 'hsl(12, 72%, 45%)' );
	} );
} );
