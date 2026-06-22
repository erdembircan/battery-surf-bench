/**
 * Drain-graph geometry — turns a run's samples into the SVG path data the
 * summary's battery chart draws.
 *
 * Pure and presentation-only: it maps the run-length-encoded samples (elapsed
 * time, battery level) into viewport coordinates and emits path `d` strings plus
 * axis tick positions. The store binds these onto a static SVG skeleton in the
 * markup (so no HTML is built here), and the maths stays testable without a DOM.
 * The chart shows the measured battery as a staircase (the level is quantized)
 * with the least-squares drain fit drawn straight over it.
 */

import { type Sample, drainRate } from './DrainRate';

/** The SVG viewport the graph is drawn into, with its inner padding. */
export interface GraphViewport {
	width: number;
	height: number;
	padLeft: number;
	padRight: number;
	padTop: number;
	padBottom: number;
}

/** A positioned axis tick: a coordinate and its label. */
export interface GraphTick {
	pos: number;
	label: string;
}

/** The computed path data and ticks for the chart. */
export interface GraphModel {
	/** Stepped path `d` tracing the measured battery over time. */
	step: string;
	/** Filled area `d` under the stepped path. */
	area: string;
	/** Straight least-squares drain-fit `d`, or null when no slope exists. */
	fit: string | null;
	/** Horizontal grid ticks (battery %), with their y coordinates. */
	yTicks: GraphTick[];
	/** Vertical axis ticks (elapsed minutes), with their x coordinates. */
	xTicks: GraphTick[];
}

/**
 * Rounds to one decimal as a compact path-coordinate string.
 * @param value
 */
const n = ( value: number ): string =>
	( Math.round( value * 10 ) / 10 ).toString();

/**
 * Builds the chart geometry for a run's samples, or null when there is nothing
 * to plot (fewer than two samples, or no elapsed span). Battery levels are 0..1
 * fractions; the y range is fitted to the observed levels (snapped out to whole
 * percents) so the staircase fills the chart.
 * @param samples The run's samples, oldest first.
 * @param vp      The viewport to map into.
 */
export const buildGraph = (
	samples: readonly Sample[],
	vp: GraphViewport
): GraphModel | null => {
	if ( samples.length < 2 ) {
		return null;
	}

	const maxT = samples[ samples.length - 1 ]!.t;
	if ( maxT <= 0 ) {
		return null;
	}

	const levels = samples.map( ( s ) => s.level );
	const rawLo = Math.min( ...levels );
	const rawHi = Math.max( ...levels );
	// Snap the range out to whole percents, keeping at least a 2-point span so a
	// shallow drain still reads as a slope rather than a flat line.
	let loPct = Math.floor( rawLo * 100 );
	let hiPct = Math.ceil( rawHi * 100 );
	if ( hiPct - loPct < 2 ) {
		loPct -= 1;
		hiPct += 1;
	}
	const lo = loPct / 100;
	const hi = hiPct / 100;

	const left = vp.padLeft;
	const right = vp.width - vp.padRight;
	const top = vp.padTop;
	const bottom = vp.height - vp.padBottom;

	const sx = ( t: number ): number => left + ( t / maxT ) * ( right - left );
	const sy = ( level: number ): number =>
		top + ( ( hi - level ) / ( hi - lo ) ) * ( bottom - top );

	// Staircase through the samples: hold the previous level across to each new
	// time, then step to the new level.
	let step = `M ${ n( sx( samples[ 0 ]!.t ) ) } ${ n(
		sy( samples[ 0 ]!.level )
	) }`;
	for ( let i = 1; i < samples.length; i++ ) {
		const x = sx( samples[ i ]!.t );
		step += ` L ${ n( x ) } ${ n( sy( samples[ i - 1 ]!.level ) ) }`;
		step += ` L ${ n( x ) } ${ n( sy( samples[ i ]!.level ) ) }`;
	}

	const area = `${ step } L ${ n( sx( maxT ) ) } ${ n( bottom ) } L ${ n(
		sx( 0 )
	) } ${ n( bottom ) } Z`;

	return {
		step,
		area,
		fit: fitPath( samples, maxT, sx, sy ),
		yTicks: yTicks( loPct, hiPct, sy ),
		xTicks: xTicks( maxT, sx ),
	};
};

/**
 * The straight least-squares drain-fit path across the chart, or null when the
 * samples have no slope (the chart then shows only the measured staircase).
 * @param samples
 * @param maxT
 * @param sx
 * @param sy
 */
const fitPath = (
	samples: readonly Sample[],
	maxT: number,
	sx: ( t: number ) => number,
	sy: ( level: number ) => number
): string | null => {
	const usable = samples.filter( ( s ) => ! s.charging );
	if ( drainRate( usable ).pctPerHour === null ) {
		return null;
	}

	let sumT = 0;
	let sumL = 0;
	let sumTT = 0;
	let sumTL = 0;
	for ( const s of usable ) {
		sumT += s.t;
		sumL += s.level;
		sumTT += s.t * s.t;
		sumTL += s.t * s.level;
	}
	const count = usable.length;
	const slope =
		( count * sumTL - sumT * sumL ) / ( count * sumTT - sumT * sumT );
	const intercept = ( sumL - slope * sumT ) / count;

	const y0 = intercept;
	const y1 = intercept + slope * maxT;

	return `M ${ n( sx( 0 ) ) } ${ n( sy( y0 ) ) } L ${ n( sx( maxT ) ) } ${ n(
		sy( y1 )
	) }`;
};

/**
 * Battery-percent grid ticks at multiples of five within the range.
 * @param loPct
 * @param hiPct
 * @param sy
 */
const yTicks = (
	loPct: number,
	hiPct: number,
	sy: ( level: number ) => number
): GraphTick[] => {
	const ticks: GraphTick[] = [];
	const first = Math.ceil( loPct / 5 ) * 5;
	for ( let pct = first; pct <= hiPct; pct += 5 ) {
		ticks.push( {
			pos: Math.round( sy( pct / 100 ) * 10 ) / 10,
			label: String( pct ),
		} );
	}

	return ticks;
};

/**
 * Elapsed-minute ticks at the start, midpoint and end of the run.
 * @param maxT
 * @param sx
 */
const xTicks = ( maxT: number, sx: ( t: number ) => number ): GraphTick[] => {
	const mins = ( t: number ): string => String( Math.round( t / 60_000 ) );

	return [
		{ pos: Math.round( sx( 0 ) * 10 ) / 10, label: '0' },
		{
			pos: Math.round( sx( maxT / 2 ) * 10 ) / 10,
			label: mins( maxT / 2 ),
		},
		{
			pos: Math.round( sx( maxT ) * 10 ) / 10,
			label: `${ mins( maxT ) }m`,
		},
	];
};
