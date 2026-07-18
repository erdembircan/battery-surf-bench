/**
 * The shared arithmetic behind every behavior's bid: `drive × affordance ×
 * appetite × noise`. Each behavior supplies its own affordance and appetite;
 * this module holds the two pieces that are
 * identical everywhere — the trait-to-drive mapping and the random jitter —
 * so every behavior reads the same floor and the same noise band.
 */

import type { Rng } from '@/surfer/Rng';
import { MAX } from '@/shared/SurferStats';

/** Floor drive a zero-valued stat still contributes, so nothing is ever ruled out. */
export const DRIVE_FLOOR = 0.05;

/** How far bid noise can swing a bid up or down, as a fraction of its value. */
export const NOISE_AMP = 0.35;

/**
 * Clamps a value into `[0, 1]`.
 * @param value
 */
export const clamp01 = ( value: number ): number =>
	Math.max( 0, Math.min( 1, value ) );

/**
 * Linear interpolation from `min` to `max`, at fraction `t` clamped to `[0, 1]`.
 * @param min
 * @param max
 * @param t
 */
export const lerp = ( min: number, max: number, t: number ): number =>
	min + ( max - min ) * clamp01( t );

/**
 * Maps a stat value to its drive contribution: `DRIVE_FLOOR` at zero, `1` at
 * `MAX`, linear between. A zero-valued stat still bids faintly — the RPG
 * floor — rather than being gated out entirely.
 * @param stat
 */
export const drive = ( stat: number ): number =>
	lerp( DRIVE_FLOOR, 1, stat / MAX );

/**
 * A random multiplier centered on `1`, swinging by up to `NOISE_AMP` either
 * way, clamped at `0` so a bid can never go negative.
 * @param rng
 */
export const noise = ( rng: Rng ): number =>
	Math.max( 0, 1 + NOISE_AMP * ( rng() * 2 - 1 ) );
