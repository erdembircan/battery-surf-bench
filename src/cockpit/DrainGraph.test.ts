/**
 * Tests for the drain-graph geometry.
 *
 * The consumer is the summary painter, which draws the returned draw model onto
 * an SVG. These tests verify the guards (nothing to plot), the staircase / area
 * structure, the normalised fixed axes (0–100 % over 0 → full-charge time), that
 * the projection meets the x axis at the right edge, and that plotted points
 * stay within the viewport.
 */

import { describe, it, expect } from 'vitest';
import { buildGraph, type GraphViewport } from './DrainGraph';
import type { Sample } from './DrainRate';

const VP: GraphViewport = {
	width: 480,
	height: 90,
	padLeft: 30,
	padRight: 10,
	padTop: 8,
	padBottom: 18,
};

const s = ( t: number, level: number, charging = false ): Sample => ( {
	t,
	level,
	charging,
} );

/**
 * Every numeric pair in a path `d`, as [x, y] points.
 * @param d
 */
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
		expect( buildGraph( [], 7200, VP ) ).toBeNull();
		expect( buildGraph( [ s( 0, 0.8 ) ], 7200, VP ) ).toBeNull();
		// Two samples but no elapsed span.
		expect(
			buildGraph( [ s( 0, 0.8 ), s( 0, 0.79 ) ], 7200, VP )
		).toBeNull();
	} );

	it( 'traces a staircase, a closed area and a 100→0 projection', () => {
		const g = buildGraph(
			[ s( 0, 0.82 ), s( 300_000, 0.79 ), s( 600_000, 0.75 ) ],
			7200,
			VP
		)!;

		expect( g.line.startsWith( 'M ' ) ).toBe( true );
		// Staircase: two L segments (across, then down) per step after the first.
		expect( ( g.line.match( /L/g ) ?? [] ).length ).toBe( 4 );
		expect( g.area.endsWith( 'Z' ) ).toBe( true );
		expect( g.fit ).not.toBeNull();
		expect( g.dots ).toHaveLength( 2 );
	} );

	it( 'omits the projection when no full-charge time is known', () => {
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], null, VP )!;

		expect( g ).not.toBeNull();
		expect( g.fit ).toBeNull();
	} );

	it( 'runs the projection corner-to-corner so it meets the x axis', () => {
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], 7200, VP )!;

		// (left, top) → (right, bottom): 100 % at t=0 down to 0 % at empty time.
		const pts = points( g.fit! );
		expect( pts[ 0 ] ).toEqual( [ g.frame.left, g.frame.top ] );
		expect( pts[ 1 ] ).toEqual( [ g.frame.right, g.frame.bottom ] );
	} );

	it( 'normalises the y axis to a fixed 0–100 % range', () => {
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], 7200, VP )!;

		// Ticks every 25 points across the whole range, regardless of the data.
		expect( g.yTicks.map( ( t ) => t.label ) ).toEqual( [
			'0',
			'25',
			'50',
			'75',
			'100',
		] );
		// 0 % sits on the bottom edge, 100 % on the top edge.
		expect( g.yTicks[ 0 ]!.pos ).toBe( g.frame.bottom );
		expect( g.yTicks[ 4 ]!.pos ).toBe( g.frame.top );
	} );

	it( 'labels time ticks at start/mid/end of the full-charge span', () => {
		// 7200 s = 120 min full-charge time → 0, 60, 120 min.
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], 7200, VP )!;

		expect( g.xTicks.map( ( t ) => t.label ) ).toEqual( [
			'0m',
			'1h',
			'2h',
		] );
	} );

	it( 'keeps every plotted point inside the viewport', () => {
		const g = buildGraph(
			[ s( 0, 0.82 ), s( 300_000, 0.78 ), s( 600_000, 0.75 ) ],
			7200,
			VP
		)!;

		for ( const [ x, y ] of points( g.line ) ) {
			expect( x ).toBeGreaterThanOrEqual( VP.padLeft - 0.5 );
			expect( x ).toBeLessThanOrEqual( VP.width - VP.padRight + 0.5 );
			expect( y ).toBeGreaterThanOrEqual( VP.padTop - 0.5 );
			expect( y ).toBeLessThanOrEqual( VP.height - VP.padBottom + 0.5 );
		}
	} );
} );
