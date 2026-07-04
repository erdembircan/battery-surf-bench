/**
 * Seedable PRNG for the surf engine. Every source of randomness in the engine
 * — bid noise, jittered durations, roulette draws — takes one of these rather
 * than reaching for `Math.random()`, so a seeded run is fully reproducible in
 * tests.
 */

/** A uniform random draw in `[0, 1)`. */
export type Rng = () => number;

/**
 * Builds a mulberry32 generator from a 32-bit seed. Small, fast, and
 * dependency-free — good enough for behavioral jitter, not for cryptography.
 * @param seed
 */
// The mulberry32 body below is a 32-bit integer bit-mixing algorithm — the
// bitwise ops are the algorithm itself, not a stray `&`/`&&` typo risk.
/* eslint-disable no-bitwise */
export const mulberry32 =
	( seed: number ): Rng =>
	(): number => {
		seed |= 0;
		seed = ( seed + 0x6d2b79f5 ) | 0;
		let t = Math.imul( seed ^ ( seed >>> 15 ), 1 | seed );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
/* eslint-enable no-bitwise */
