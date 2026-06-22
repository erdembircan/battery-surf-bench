/**
 * Drain-graph geometry — turns a run's samples and its full-charge projection
 * into a flat, serialisable draw model for the summary's battery chart.
 *
 * Pure and presentation-agnostic: it maps the run-length-encoded samples
 * (elapsed time, battery level) into a fixed, normalised coordinate space and
 * emits the path/tick/marker geometry. The frame is the same shape as the SVG
 * viewBox, so the painter ({@link ./GraphSvg}) draws it at a uniform scale with
 * no `preserveAspectRatio` stretching. The maths stays testable without a DOM.
 *
 * The frame is normalised, not fitted to the observed window: the y axis always
 * spans 0–100 % and the x axis spans 0 to the projected full-charge runtime, so
 * the dashed 100 → 0 projection runs corner-to-corner and meets the x axis at
 * the right edge. The measured battery is drawn over it as a staircase (the
 * level is quantised), occupying the slice of full-charge time the run covered.
 */

import { type Sample } from './DrainRate';

/** The SVG viewport the graph is drawn into, with its inner padding. */
export interface GraphViewport {
	width: number;
	height: number;
	padLeft: number;
	padRight: number;
	padTop: number;
	padBottom: number;
}

/** The plot box (inside the padding) the series and axes are drawn within. */
export interface GraphFrame {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** A positioned axis tick: a coordinate and its label. */
export interface GraphTick {
	pos: number;
	label: string;
}

/** A plotted point marker. */
export interface GraphDot {
	cx: number;
	cy: number;
}

/** The flat, serialisable draw model for one run's chart. */
export interface GraphModel {
	/** The plot box the painter draws gridlines, axes and series within. */
	frame: GraphFrame;
	/** Filled area `d` under the measured staircase. */
	area: string;
	/** Stepped path `d` tracing the measured battery over time. */
	line: string;
	/** Straight 100 → 0 projection `d`, or null when no rate is known. */
	fit: string | null;
	/** The measured-window band (x and width), or null when nothing measured. */
	window: { x: number; w: number } | null;
	/** Endpoint markers (first and last measured sample). */
	dots: GraphDot[];
	/** Horizontal grid ticks (battery %), with their y coordinates. */
	yTicks: GraphTick[];
	/** Vertical axis ticks (elapsed time), with their x coordinates. */
	xTicks: GraphTick[];
}

/**
 * Rounds to one decimal as a compact path-coordinate number.
 * @param value
 */
const n = ( value: number ): number => Math.round( value * 10 ) / 10;

/**
 * A compact elapsed-time label: minutes under an hour, else hours (with the
 * remaining minutes when non-zero).
 * @param minutes
 */
const timeLabel = ( minutes: number ): string => {
	const m = Math.round( minutes );
	if ( m < 60 ) {
		return `${ m }m`;
	}
	const h = Math.floor( m / 60 );
	const rem = m % 60;
	return rem ? `${ h }h${ rem }` : `${ h }h`;
};

/**
 * Builds the chart geometry for a run, or null when there is nothing to plot
 * (fewer than two samples, or no elapsed span). The y axis is fixed at 0–100 %
 * and the x axis at 0 to the projected full-charge runtime, so the projection
 * meets the x axis at the right edge; when no rate is known the x axis falls
 * back to the measured span and the projection is omitted.
 * @param samples        The run's samples, oldest first; `t` is elapsed ms, `level` a 0..1 fraction.
 * @param secondsToEmpty Projected full-charge (100 % → 0 %) runtime in seconds, or null when unknown.
 * @param vp             The viewport to map into.
 */
export const buildGraph = (
	samples: readonly Sample[],
	secondsToEmpty: number | null,
	vp: GraphViewport
): GraphModel | null => {
	if ( samples.length < 2 ) {
		return null;
	}

	const maxElapsedMin = samples[ samples.length - 1 ]!.t / 60_000;
	if ( maxElapsedMin <= 0 ) {
		return null;
	}

	// x domain: the full-charge runtime, never shorter than the measured span.
	const emptyMin =
		secondsToEmpty !== null && secondsToEmpty > 0
			? secondsToEmpty / 60
			: null;
	const domainMax = Math.max( emptyMin ?? 0, maxElapsedMin );

	const frame: GraphFrame = {
		left: vp.padLeft,
		right: vp.width - vp.padRight,
		top: vp.padTop,
		bottom: vp.height - vp.padBottom,
	};

	const sx = ( min: number ): number =>
		frame.left + ( min / domainMax ) * ( frame.right - frame.left );
	// y is normalised to a fixed 0..100 % range, top to bottom.
	const sy = ( pct: number ): number =>
		frame.top + ( ( 100 - pct ) / 100 ) * ( frame.bottom - frame.top );

	// Staircase through the samples: hold the previous level across to each new
	// time, then step down to the new level.
	const px = ( s: Sample ): number => sx( s.t / 60_000 );
	const py = ( s: Sample ): number => sy( s.level * 100 );
	let line = `M ${ n( px( samples[ 0 ]! ) ) } ${ n( py( samples[ 0 ]! ) ) }`;
	for ( let i = 1; i < samples.length; i++ ) {
		const x = n( px( samples[ i ]! ) );
		line += ` L ${ x } ${ n( py( samples[ i - 1 ]! ) ) }`;
		line += ` L ${ x } ${ n( py( samples[ i ]! ) ) }`;
	}

	const lastX = n( px( samples[ samples.length - 1 ]! ) );
	const baseY = n( sy( 0 ) );
	const firstX = n( px( samples[ 0 ]! ) );
	const area = `${ line } L ${ lastX } ${ baseY } L ${ firstX } ${ baseY } Z`;

	const fit =
		emptyMin !== null
			? `M ${ n( sx( 0 ) ) } ${ n( sy( 100 ) ) } L ${ n(
					sx( emptyMin )
			  ) } ${ n( sy( 0 ) ) }`
			: null;

	return {
		frame,
		area,
		line,
		fit,
		window: {
			x: frame.left,
			w: n( px( samples[ samples.length - 1 ]! ) - frame.left ),
		},
		dots: [
			{ cx: firstX, cy: n( py( samples[ 0 ]! ) ) },
			{ cx: lastX, cy: n( py( samples[ samples.length - 1 ]! ) ) },
		],
		yTicks: yTicks( sy ),
		xTicks: xTicks( domainMax, sx ),
	};
};

/**
 * Battery-percent grid ticks at 0/25/50/75/100 across the fixed y range.
 * @param sy
 */
const yTicks = ( sy: ( pct: number ) => number ): GraphTick[] => {
	const ticks: GraphTick[] = [];
	for ( let pct = 0; pct <= 100; pct += 25 ) {
		ticks.push( { pos: n( sy( pct ) ), label: String( pct ) } );
	}
	return ticks;
};

/**
 * Elapsed-time ticks at the start, midpoint and end of the x domain.
 * @param domainMax The x domain maximum, in minutes.
 * @param sx
 */
const xTicks = (
	domainMax: number,
	sx: ( min: number ) => number
): GraphTick[] =>
	[ 0, domainMax / 2, domainMax ].map( ( min ) => ( {
		pos: n( sx( min ) ),
		label: timeLabel( min ),
	} ) );
