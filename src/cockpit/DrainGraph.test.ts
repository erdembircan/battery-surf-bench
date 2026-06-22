/**
 * Tests for the drain-graph geometry.
 *
 * The consumer is the store, which binds the returned path `d` strings and tick
 * positions onto the summary's SVG. These tests verify the guards (nothing to
 * plot), the staircase/area/fit structure, the fitted y range, and that every
 * coordinate stays within the viewport.
 */

import { describe, it, expect } from 'vitest';
import { buildGraph, type GraphViewport } from './DrainGraph';
import type { Sample } from './DrainRate';

const VP: GraphViewport = {
	width: 360,
	height: 120,
	padLeft: 26,
	padRight: 8,
	padTop: 8,
	padBottom: 18,
};

const s = ( t: number, level: number, charging = false ): Sample => ( {
	t,
	level,
	charging,
} );

/** Every numeric pair in a path `d`, as [x, y] points. */
const points = ( d: string ): Array< [ number, number ] > => {
	const nums = ( d.match( /-?\d+(\.\d+)?/g ) ?? [] ).map( Number );
	const pts: Array< [ number, number ] > = [];
	for ( let i = 0; i + 1 < nums.length; i += 2 ) {
		pts.push( [ nums[ i ]!, nums[ i + 1 ]! ] );
	}
	return pts;
};

describe( 'buildGraph', () => {
	it( 'returns null with nothing to plot', () => {
		expect( buildGraph( [], VP ) ).toBeNull();
		expect( buildGraph( [ s( 0, 0.8 ) ], VP ) ).toBeNull();
		// Two samples but no elapsed span.
		expect( buildGraph( [ s( 0, 0.8 ), s( 0, 0.79 ) ], VP ) ).toBeNull();
	} );

	it( 'traces a staircase, a closed area and a drain fit', () => {
		const g = buildGraph(
			[ s( 0, 0.82 ), s( 300_000, 0.79 ), s( 600_000, 0.75 ) ],
			VP
		)!;

		expect( g.step.startsWith( 'M ' ) ).toBe( true );
		// Staircase: two L segments (across, then down) per step after the first.
		expect( ( g.step.match( /L/g ) ?? [] ).length ).toBe( 4 );
		expect( g.area.endsWith( 'Z' ) ).toBe( true );
		expect( g.fit ).not.toBeNull();
	} );

	it( 'omits the fit when the battery has not stepped', () => {
		const g = buildGraph( [ s( 0, 0.8 ), s( 600_000, 0.8 ) ], VP )!;

		expect( g ).not.toBeNull();
		expect( g.fit ).toBeNull();
	} );

	it( 'keeps every plotted point inside the viewport', () => {
		const g = buildGraph(
			[ s( 0, 0.82 ), s( 300_000, 0.78 ), s( 600_000, 0.75 ) ],
			VP
		)!;

		for ( const [ x, y ] of points( g.step ) ) {
			expect( x ).toBeGreaterThanOrEqual( VP.padLeft - 0.5 );
			expect( x ).toBeLessThanOrEqual( VP.width - VP.padRight + 0.5 );
			expect( y ).toBeGreaterThanOrEqual( VP.padTop - 0.5 );
			expect( y ).toBeLessThanOrEqual( VP.height - VP.padBottom + 0.5 );
		}
	} );

	it( 'labels battery ticks at fives and time ticks at start/mid/end', () => {
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], VP )!;

		expect( g.yTicks.map( ( t ) => t.label ) ).toEqual( [ '75', '80' ] );
		expect( g.xTicks.map( ( t ) => t.label ) ).toEqual( [ '0', '5', '10m' ] );
	} );
} );
