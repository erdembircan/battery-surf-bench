/**
 * Tests for the drain-graph painter.
 *
 * The consumer is the cockpit store, which hands it the summary's SVG element
 * and a draw model. These tests verify it renders the model into the expected
 * SVG nodes (in the SVG namespace), honours an absent projection, clears the
 * chart for a null model, and anchors the time labels at the axis ends inward
 * so they stay inside the plot.
 */

import { describe, it, expect } from 'vitest';
import { paintGraph } from '@/cockpit/GraphSvg';
import type { GraphModel, GraphTick } from '@/cockpit/DrainGraph';

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgEl = (): SVGElement => document.createElementNS( SVG_NS, 'svg' );

const model = (): GraphModel => ( {
	frame: { left: 30, right: 470, top: 10, bottom: 208 },
	area: 'M 30 45 L 60 59 Z',
	line: 'M 30 45 L 60 59',
	fit: 'M 30 10 L 470 208',
	dots: [
		{ cx: 30, cy: 45 },
		{ cx: 60, cy: 59 },
	],
	yTicks: [
		{ pos: 208, label: '0' },
		{ pos: 10, label: '100' },
	],
	xTicks: [
		{ pos: 30, label: '0m' },
		{ pos: 470, label: '2h' },
	],
} );

/** A start / midpoint / end time axis: the three ticks the geometry emits. */
const timeAxis = (): GraphTick[] => [
	{ pos: 30, label: '0m' },
	{ pos: 250, label: '35m' },
	{ pos: 470, label: '1h10' },
];

describe( 'paintGraph', () => {
	it( 'renders the model into svg elements', () => {
		const svg = svgEl();
		paintGraph( svg, model() );

		expect(
			svg.querySelectorAll( '.bsb-summary__chart-grid' )
		).toHaveLength( 2 );
		expect(
			svg.querySelector( '.bsb-summary__chart-base' )
		).not.toBeNull();
		expect(
			svg.querySelectorAll( '.bsb-summary__chart-label--y' )
		).toHaveLength( 2 );
		expect(
			svg.querySelectorAll( '.bsb-summary__chart-label--x' )
		).toHaveLength( 2 );
		expect(
			svg.querySelector( '.bsb-summary__chart-area' )?.getAttribute( 'd' )
		).toBe( 'M 30 45 L 60 59 Z' );
		expect(
			svg.querySelector( '.bsb-summary__chart-fit' )?.getAttribute( 'd' )
		).toBe( 'M 30 10 L 470 208' );
		expect(
			svg.querySelector( '.bsb-summary__chart-line' )?.getAttribute( 'd' )
		).toBe( 'M 30 45 L 60 59' );
		expect(
			svg.querySelectorAll( '.bsb-summary__chart-dot' )
		).toHaveLength( 2 );
	} );

	it( 'omits the projection when the model has none', () => {
		const svg = svgEl();
		paintGraph( svg, { ...model(), fit: null } );

		expect( svg.querySelector( '.bsb-summary__chart-fit' ) ).toBeNull();
		expect(
			svg.querySelector( '.bsb-summary__chart-line' )
		).not.toBeNull();
	} );

	it( 'clears the svg for a null model', () => {
		const svg = svgEl();
		paintGraph( svg, model() );
		expect( svg.childNodes.length ).toBeGreaterThan( 0 );

		paintGraph( svg, null );
		expect( svg.childNodes.length ).toBe( 0 );
	} );

	it( 'creates nodes in the svg namespace', () => {
		const svg = svgEl();
		paintGraph( svg, model() );

		expect(
			svg.querySelector( '.bsb-summary__chart-line' )!.namespaceURI
		).toBe( SVG_NS );
	} );

	it( 'keeps the first and last time labels inside the plot by anchoring them inward', () => {
		const svg = svgEl();
		const m = { ...model(), xTicks: timeAxis() };
		paintGraph( svg, m );

		const labels = svg.querySelectorAll( '.bsb-summary__chart-label--x' );
		const first = labels[ 0 ]!;
		const last = labels[ labels.length - 1 ]!;

		// The first label sits on the plot's left edge and runs rightward from it.
		expect( first ).toHaveAttribute( 'x', String( m.frame.left ) );
		expect( first ).toHaveClass( 'bsb-summary__chart-label--start' );
		expect( first ).not.toHaveClass( 'bsb-summary__chart-label--end' );

		// The last label sits on the right edge and runs leftward from it.
		expect( last ).toHaveAttribute( 'x', String( m.frame.right ) );
		expect( last ).toHaveClass( 'bsb-summary__chart-label--end' );
		expect( last ).not.toHaveClass( 'bsb-summary__chart-label--start' );
	} );

	it( 'keeps the middle time labels centred on their ticks', () => {
		const svg = svgEl();
		paintGraph( svg, { ...model(), xTicks: timeAxis() } );

		const middle = svg.querySelectorAll(
			'.bsb-summary__chart-label--x'
		)[ 1 ]!;
		expect( middle ).toHaveTextContent( '35m' );
		expect( middle ).toHaveAttribute( 'x', '250' );
		expect( middle ).not.toHaveClass( 'bsb-summary__chart-label--start' );
		expect( middle ).not.toHaveClass( 'bsb-summary__chart-label--end' );
	} );
} );
