/**
 * Tempo is the engine's metronome, not a bidder: it never enters an auction,
 * it scales the clock and the motor directly. These are the three
 * levers it scales — tick cadence, scroll-flick size, and the flick's easing
 * time — all linear in the tempo stat, fastest at `MAX`.
 */

import { lerp } from '@/surfer/Bid';
import { MAX } from '@/shared/SurferStats';

/** Slowest and fastest tick interval, in ms, at tempo 0 and tempo MAX. */
const TICK_MS_SLOW = 1400;
const TICK_MS_FAST = 350;

/** Smallest and largest scroll-flick burst, in px, at tempo 0 and tempo MAX. */
const FLICK_PX_SMALL = 350;
const FLICK_PX_LARGE = 800;

/** Slowest and fastest flick easing time, in ms, at tempo 0 and tempo MAX. */
const FLICK_EASE_MS_SLOW = 400;
const FLICK_EASE_MS_FAST = 150;

/**
 * How long the engine waits between ticks at the given tempo.
 * @param tempo
 */
export const tickIntervalMs = ( tempo: number ): number =>
	lerp( TICK_MS_SLOW, TICK_MS_FAST, tempo / MAX );

/**
 * How many pixels a scroll flick covers at the given tempo.
 * @param tempo
 */
export const flickPx = ( tempo: number ): number =>
	lerp( FLICK_PX_SMALL, FLICK_PX_LARGE, tempo / MAX );

/**
 * How long a scroll flick takes to ease out at the given tempo.
 * @param tempo
 */
export const flickEaseMs = ( tempo: number ): number =>
	lerp( FLICK_EASE_MS_SLOW, FLICK_EASE_MS_FAST, tempo / MAX );
