/**
 * Tests for the drain-graph painter.
 *
 * The consumer is the cockpit store, which hands it the summary's SVG element
 * and a draw model. These tests verify it renders the model into the expected
 * SVG nodes (in the SVG namespace), honours an absent projection, and clears the
 * chart for a null model.
 */

import { describe, it, expect } from 'vitest';
import { paintGraph } from './GraphSvg';
import type { GraphModel } from './DrainGraph';

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgEl = (): SVGElement => document.createElementNS( SVG_NS, 'svg' );

const model = (): GraphModel => ( {
	frame: { left: 30, right: 470, top: 10, bottom: 208 },
	area: 'M 30 45 L 60 59 Z',
	line: 'M 30 45 L 60 59',
	fit: 'M 30 10 L 470 208',
	window: { x: 30, w: 30 },
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
			svg.querySelector( '.bsb-summary__chart-window' )
		).not.toBeNull();
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
} );
