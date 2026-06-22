/**
 * Drain-graph painter — renders a {@link ./DrainGraph} draw model into an SVG
 * element.
 *
 * Kept separate from the geometry so the maths stays DOM-free and this stays a
 * dumb, data-driven renderer: it clears the target and rebuilds it from the
 * model, mapping each primitive to an SVG node with a stable class the
 * stylesheet owns. The cockpit store calls this imperatively (the Interactivity
 * runtime cannot process directives inside SVG), but the function itself is
 * pure with respect to its inputs and so testable in isolation.
 */

import type { GraphModel } from './DrainGraph';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an SVG element in the SVG namespace with the given attributes.
 * @param tag   The SVG element name.
 * @param attrs Attribute name/value pairs to set.
 */
const el = (
	tag: string,
	attrs: Record< string, string | number >
): SVGElement => {
	const node = document.createElementNS( SVG_NS, tag );
	for ( const [ name, value ] of Object.entries( attrs ) ) {
		node.setAttribute( name, String( value ) );
	}
	return node;
};

/**
 * Paints a drain-graph model into an SVG element, replacing its contents. A null
 * model clears the chart (the caller hides it when there is nothing to plot).
 * @param svg   The target SVG element.
 * @param model The draw model, or null to clear.
 */
export const paintGraph = (
	svg: SVGElement,
	model: GraphModel | null
): void => {
	svg.replaceChildren();
	if ( ! model ) {
		return;
	}

	const { frame } = model;
	const add = ( node: SVGElement ): void => {
		svg.appendChild( node );
	};

	// Horizontal gridlines + their battery-% labels.
	for ( const tick of model.yTicks ) {
		add(
			el( 'line', {
				class: 'bsb-summary__chart-grid',
				x1: frame.left,
				y1: tick.pos,
				x2: frame.right,
				y2: tick.pos,
			} )
		);
		const label = el( 'text', {
			class: 'bsb-summary__chart-label bsb-summary__chart-label--y',
			x: frame.left - 5,
			y: tick.pos + 3,
		} );
		label.textContent = tick.label;
		add( label );
	}

	// The x baseline and its elapsed-time labels.
	add(
		el( 'line', {
			class: 'bsb-summary__chart-base',
			x1: frame.left,
			y1: frame.bottom,
			x2: frame.right,
			y2: frame.bottom,
		} )
	);
	for ( const tick of model.xTicks ) {
		const label = el( 'text', {
			class: 'bsb-summary__chart-label bsb-summary__chart-label--x',
			x: tick.pos,
			y: frame.bottom + 14,
		} );
		label.textContent = tick.label;
		add( label );
	}

	// The measured-window band behind the series.
	if ( model.window ) {
		add(
			el( 'rect', {
				class: 'bsb-summary__chart-window',
				x: model.window.x,
				y: frame.top,
				width: model.window.w,
				height: frame.bottom - frame.top,
			} )
		);
	}

	// Series: measured area + staircase, with the projection dashed beneath.
	add( el( 'path', { class: 'bsb-summary__chart-area', d: model.area } ) );
	if ( model.fit ) {
		add( el( 'path', { class: 'bsb-summary__chart-fit', d: model.fit } ) );
	}
	add( el( 'path', { class: 'bsb-summary__chart-line', d: model.line } ) );

	// Endpoint markers on top.
	for ( const dot of model.dots ) {
		add(
			el( 'circle', {
				class: 'bsb-summary__chart-dot',
				cx: dot.cx,
				cy: dot.cy,
				r: 3,
			} )
		);
	}
};
