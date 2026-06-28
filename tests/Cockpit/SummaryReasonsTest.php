<?php
/**
 * Tests for the summary verdict wording.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit;

use ErdemBircan\BatterySurfBench\Cockpit\SummaryReasons;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The verdict wording is the single source both the cockpit block and the
 * session detail page seed onto their context, so its consumer contract is the
 * shape: a complete set of parts for each run-end reason the store can pick.
 */
final class SummaryReasonsTest extends TestCase {

	/**
	 * Every run-end reason carries the full wording the painter writes: a
	 * heading, a signature, and the postmark's arc and unit.
	 */
	public function test_provides_complete_wording_for_every_end_reason(): void {
		$text = SummaryReasons::text();

		foreach ( array( 'duration', 'targetDrop', 'stopped', 'plugged' ) as $reason ) {
			$this->assertArrayHasKey( $reason, $text );

			foreach ( array( 'head', 'sig', 'arc', 'unit' ) as $part ) {
				$this->assertArrayHasKey( $part, $text[ $reason ] );
				$this->assertNotSame( '', $text[ $reason ][ $part ] );
			}
		}
	}
}
