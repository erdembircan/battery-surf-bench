<?php
/**
 * Translated behavior-start bark quips.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use function __;

defined( 'ABSPATH' ) || exit;

/**
 * The single source of the cockpit's bark flavor text, keyed by behavior key —
 * two variants each, one picked at random when the behavior starts running.
 *
 * The keys are string literals mirroring the surf engine's exported `*_KEY`
 * constants (e.g. `READ_PAUSE_KEY` in `src/surfer/Behaviors/ReadPause.ts`);
 * PHP cannot import them, so this class keeps its own copy. A behavior key
 * absent here never barks — the mechanical, frequent behaviors (`scrollBurst`,
 * `microScroll`, `fidgetWiggle`) have no entry.
 */
class BarkStrings {

	/**
	 * The bark flavor text for every barking behavior: two translated variants
	 * each, keyed by the behavior's key.
	 *
	 * @return array<string, string[]> Behavior key mapped to its two flavor variants.
	 */
	public static function text(): array {
		return array(
			'readPause'     => array(
				__( 'Deep in the good words…', 'battery-surf-bench' ),
				__( 'Catching up on the fine print…', 'battery-surf-bench' ),
			),
			'glanceBack'    => array(
				__( 'Wait — what did that say?', 'battery-surf-bench' ),
				__( 'Paddling back for a second look…', 'battery-surf-bench' ),
			),
			'watchVideo'    => array(
				__( 'Ooh, moving pictures!', 'battery-surf-bench' ),
				__( 'Popcorn out — the video is rolling…', 'battery-surf-bench' ),
			),
			'lingerImage'   => array(
				__( 'Basking in the beauty of the pictures…', 'battery-surf-bench' ),
				__( 'Ooh, shiny pixels…', 'battery-surf-bench' ),
			),
			'selectSnippet' => array(
				__( 'Highlighting the juicy bits…', 'battery-surf-bench' ),
				__( 'This part deserves a highlight…', 'battery-surf-bench' ),
			),
			'moveOn'        => array(
				__( 'Paddling off to the next page…', 'battery-surf-bench' ),
				__( 'This wave is done — surfing on…', 'battery-surf-bench' ),
			),
		);
	}
}
