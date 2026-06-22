/**
 * Tests for the drain-graph geometry.
 *
 * The consumer is the summary painter, which draws the returned draw model onto
 * an SVG. These tests verify the guards (nothing to plot), the staircase / area
 * structure, the session-fitted padded axes, and that the 100 → 0 projection is
 * clipped into the zoomed frame — present when it crosses the window, omitted
 * when it falls outside it.
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

	it( 'traces a staircase, a closed area and endpoint dots', () => {
		const g = buildGraph(
			[ s( 0, 0.82 ), s( 300_000, 0.79 ), s( 600_000, 0.75 ) ],
			7200,
			VP
		)!;

		expect( g.line.startsWith( 'M ' ) ).toBe( true );
		// Staircase: two L segments (across, then down) per step after the first.
		expect( ( g.line.match( /L/g ) ?? [] ).length ).toBe( 4 );
		expect( g.area.endsWith( 'Z' ) ).toBe( true );
		expect( g.dots ).toHaveLength( 2 );
	} );

	it( 'fits the y axis to the observed range, padded out to whole fives', () => {
		// 75 %..82 % → padded/snapped to 70..85, ticks every five.
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], 7200, VP )!;

		expect( g.yTicks.map( ( t ) => t.label ) ).toEqual( [
			'70',
			'75',
			'80',
			'85',
		] );
		// The low end sits on the bottom edge, the high end on the top edge.
		expect( g.yTicks[ 0 ]!.pos ).toBe( g.frame.bottom );
		expect( g.yTicks[ g.yTicks.length - 1 ]!.pos ).toBe( g.frame.top );
	} );

	it( 'fits the x axis to the run length plus rounded headroom', () => {
		// 10 min run → padded to 11.8, rounded up to 12 min.
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], 7200, VP )!;

		expect( g.xTicks.map( ( t ) => t.label ) ).toEqual( [
			'0m',
			'6m',
			'12m',
		] );
	} );

	it( 'omits the projection when it falls outside the zoomed window', () => {
		// A short, shallow run: the 100 → 0 line over the first 12 min sits well
		// above the 70–85 % window, so none of it is in view.
		const g = buildGraph(
			[ s( 0, 0.82 ), s( 600_000, 0.75 ) ],
			7_680,
			VP
		)!;

		expect( g.fit ).toBeNull();
	} );

	it( 'clips the projection into the frame when it crosses the window', () => {
		// A longer, deeper run (82 % → 40 % over an hour): the projection enters
		// the fitted window and is drawn, clipped to the plot box.
		const g = buildGraph(
			[ s( 0, 0.82 ), s( 3_600_000, 0.4 ) ],
			8_568,
			VP
		)!;

		expect( g.fit ).not.toBeNull();
		for ( const [ x, y ] of points( g.fit! ) ) {
			expect( x ).toBeGreaterThanOrEqual( g.frame.left - 0.5 );
			expect( x ).toBeLessThanOrEqual( g.frame.right + 0.5 );
			expect( y ).toBeGreaterThanOrEqual( g.frame.top - 0.5 );
			expect( y ).toBeLessThanOrEqual( g.frame.bottom + 0.5 );
		}
	} );

	it( 'omits the projection when no full-charge time is known', () => {
		const g = buildGraph( [ s( 0, 0.82 ), s( 600_000, 0.75 ) ], null, VP )!;

		expect( g ).not.toBeNull();
		expect( g.fit ).toBeNull();
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
