<?php
/**
 * Translated run-summary verdict wording.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use function __;

defined( 'ABSPATH' ) || exit;

/**
 * The single source of the summary's verdict wording, keyed by how a run ended.
 *
 * The summary store picks the set matching the end reason and the painter writes
 * its heading, signature and postmark text from it. The cockpit block and the
 * stored-session detail page both seed this onto their Interactivity context, so
 * the wording is defined once here rather than copied into each render path.
 */
class SummaryReasons {

	/**
	 * The verdict wording for every end reason: the handwritten heading and
	 * signature, and the postmark's curved label and centre unit.
	 *
	 * @return array<string, array<string, string>> End reason mapped to its wording.
	 */
	public static function text(): array {
		return array(
			'duration'   => array(
				'head' => __( 'The run is in.', 'battery-surf-bench' ),
				'sig'  => __( 'Ran the full duration.', 'battery-surf-bench' ),
				'arc'  => __( '· COMPLETED ·', 'battery-surf-bench' ),
				'unit' => __( 'run', 'battery-surf-bench' ),
			),
			'targetDrop' => array(
				'head' => __( 'Target reached.', 'battery-surf-bench' ),
				'sig'  => __( 'The battery hit your mark.', 'battery-surf-bench' ),
				'arc'  => __( '· TARGET MET ·', 'battery-surf-bench' ),
				'unit' => __( 'reached', 'battery-surf-bench' ),
			),
			'stopped'    => array(
				'head' => __( 'Called it early.', 'battery-surf-bench' ),
				'sig'  => __( 'You stopped the run.', 'battery-surf-bench' ),
				'arc'  => __( '· STOPPED ·', 'battery-surf-bench' ),
				'unit' => __( 'elapsed', 'battery-surf-bench' ),
			),
			'plugged'    => array(
				'head' => __( 'Plugged back in.', 'battery-surf-bench' ),
				'sig'  => __( 'The charger ended the run.', 'battery-surf-bench' ),
				'arc'  => __( '· INTERRUPTED ·', 'battery-surf-bench' ),
				'unit' => __( 'elapsed', 'battery-surf-bench' ),
			),
			'loadError'  => array(
				'head' => __( "The page didn't load.", 'battery-surf-bench' ),
				'sig'  => __( "A page couldn't be reached, so the run stopped.", 'battery-surf-bench' ),
				'arc'  => __( '· LOAD FAILED ·', 'battery-surf-bench' ),
				'unit' => __( 'elapsed', 'battery-surf-bench' ),
			),
		);
	}
}
