/**
 * Drain-graph geometry — turns a run's samples and its full-charge projection
 * into a flat, serialisable draw model for the summary's battery chart.
 *
 * Pure and presentation-agnostic: it maps the run-length-encoded samples
 * (elapsed time, battery level) into a coordinate space and emits the
 * path/tick/marker geometry. The frame is the same shape as the SVG viewBox, so
 * the painter ({@link ./GraphSvg}) draws it at a uniform scale with no
 * `preserveAspectRatio` stretching. The maths stays testable without a DOM.
 *
 * The frame is fitted to the session, not the full charge: the y axis spans the
 * observed battery range padded out to whole fives, and the x axis spans 0 to a
 * padded, rounded run length — so a short or shallow run still fills the chart.
 * The 100 → 0 projection is drawn into that same zoomed frame, clipped to the
 * plot box: it runs through the section and exits the view, and for many runs
 * (the early, high-battery slice of a long projection) it falls outside the
 * fitted window entirely and is omitted.
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
	/** The 100 → 0 projection `d`, clipped to the frame; null when out of view. */
	fit: string | null;
	/** Endpoint markers (first and last measured sample). */
	dots: GraphDot[];
	/** Horizontal grid ticks (battery %), with their y coordinates. */
	yTicks: GraphTick[];
	/** Vertical axis ticks (elapsed time), with their x coordinates. */
	xTicks: GraphTick[];
}

/** Percentage points of headroom padded above/below the observed battery range. */
const PAD_PCT = 2;
/** Fraction of the run length padded onto the x axis past the last sample. */
const PAD_TIME = 0.18;

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
 * The minute the x axis rounds up to, scaled to the run length so ticks land on
 * tidy values for short, medium and long runs.
 * @param minutes The run length in minutes.
 */
const xRoundUnit = ( minutes: number ): number => {
	if ( minutes < 20 ) {
		return 1;
	}
	if ( minutes < 90 ) {
		return 5;
	}
	return 15;
};

/**
 * The battery-% step between y gridlines, widened as the fitted range grows so
 * the tick count stays readable.
 * @param range The fitted y range in percentage points.
 */
const yTickStep = ( range: number ): number => {
	if ( range <= 20 ) {
		return 5;
	}
	if ( range <= 50 ) {
		return 10;
	}
	return 20;
};

/**
 * Builds the chart geometry for a run, or null when there is nothing to plot
 * (fewer than two samples, or no elapsed span). The axes are fitted to the
 * session and padded; the 100 → 0 projection is clipped into that zoomed frame,
 * so it may exit the view or fall outside it entirely (and is then omitted).
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

	// y domain: the observed battery range, padded and snapped out to whole fives.
	const levels = samples.map( ( s ) => s.level * 100 );
	const minL = Math.min( ...levels );
	const maxL = Math.max( ...levels );
	let lo = Math.max( 0, Math.floor( ( minL - PAD_PCT ) / 5 ) * 5 );
	let hi = Math.min( 100, Math.ceil( ( maxL + PAD_PCT ) / 5 ) * 5 );
	if ( hi - lo < 5 ) {
		hi = Math.min( 100, lo + 5 );
		lo = Math.max( 0, hi - 5 );
	}

	// x domain: the run length plus headroom, rounded up to a tidy unit.
	const unit = xRoundUnit( maxElapsedMin );
	const xMax = Math.max(
		unit,
		Math.ceil( ( maxElapsedMin * ( 1 + PAD_TIME ) ) / unit ) * unit
	);

	const frame: GraphFrame = {
		left: vp.padLeft,
		right: vp.width - vp.padRight,
		top: vp.padTop,
		bottom: vp.height - vp.padBottom,
	};

	const sx = ( min: number ): number =>
		frame.left + ( min / xMax ) * ( frame.right - frame.left );
	const sy = ( pct: number ): number =>
		frame.top +
		( ( hi - pct ) / ( hi - lo ) ) * ( frame.bottom - frame.top );

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
	const baseY = n( sy( lo ) );
	const firstX = n( px( samples[ 0 ]! ) );
	const area = `${ line } L ${ lastX } ${ baseY } L ${ firstX } ${ baseY } Z`;

	return {
		frame,
		area,
		line,
		fit: fitPath( secondsToEmpty, lo, hi, xMax, sx, sy ),
		dots: [
			{ cx: firstX, cy: n( py( samples[ 0 ]! ) ) },
			{ cx: lastX, cy: n( py( samples[ samples.length - 1 ]! ) ) },
		],
		yTicks: yTicks( lo, hi, sy ),
		xTicks: xTicks( xMax, sx ),
	};
};

/**
 * The 100 → 0 projection clipped to the fitted frame, or null when none of it
 * falls inside the zoomed window. The projection is `level = 100·(1 − t/empty)`;
 * the visible slice is where that line is both within the run window (x) and the
 * padded battery range (y).
 * @param secondsToEmpty Projected full-charge runtime in seconds, or null.
 * @param lo             The y domain minimum (battery %).
 * @param hi             The y domain maximum (battery %).
 * @param xMax           The x domain maximum (minutes).
 * @param sx
 * @param sy
 */
const fitPath = (
	secondsToEmpty: number | null,
	lo: number,
	hi: number,
	xMax: number,
	sx: ( min: number ) => number,
	sy: ( pct: number ) => number
): string | null => {
	if ( secondsToEmpty === null || secondsToEmpty <= 0 ) {
		return null;
	}
	const emptyMin = secondsToEmpty / 60;

	// The line falls from 100 % at t=0; it sits in the [lo, hi] band between the
	// times it crosses hi (earlier) and lo (later). Intersect that with the run
	// window to get the visible slice.
	const tA = Math.max( 0, emptyMin * ( 1 - hi / 100 ) );
	const tB = Math.min( xMax, emptyMin * ( 1 - lo / 100 ) );
	if ( tA >= tB ) {
		return null;
	}

	const level = ( t: number ): number => 100 * ( 1 - t / emptyMin );
	return `M ${ n( sx( tA ) ) } ${ n( sy( level( tA ) ) ) } L ${ n(
		sx( tB )
	) } ${ n( sy( level( tB ) ) ) }`;
};

/**
 * Battery-percent grid ticks across the fitted y range, stepped to keep the
 * count readable as the range widens.
 * @param lo The y domain minimum (battery %).
 * @param hi The y domain maximum (battery %).
 * @param sy
 */
const yTicks = (
	lo: number,
	hi: number,
	sy: ( pct: number ) => number
): GraphTick[] => {
	const step = yTickStep( hi - lo );
	const ticks: GraphTick[] = [];
	for ( let pct = lo; pct <= hi + 0.001; pct += step ) {
		ticks.push( { pos: n( sy( pct ) ), label: String( pct ) } );
	}
	return ticks;
};

/**
 * Elapsed-time ticks at the start, midpoint and end of the x domain.
 * @param xMax The x domain maximum, in minutes.
 * @param sx
 */
const xTicks = ( xMax: number, sx: ( min: number ) => number ): GraphTick[] =>
	[ 0, xMax / 2, xMax ].map( ( min ) => ( {
		pos: n( sx( min ) ),
		label: timeLabel( min ),
	} ) );
