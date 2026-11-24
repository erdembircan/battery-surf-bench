<?php
/**
 * Tests for the run outcome mapping.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use ErdemBircan\BatterySurfBench\Content\RunOutcome;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The mapping from a stored status to the cockpit's run-end reason, which the
 * session detail screen and the AI agent abilities both read a run through.
 */
final class RunOutcomeTest extends TestCase {

	/**
	 * A hand stop reads as stopped, whatever the run was configured to do.
	 */
	public function test_a_stopped_run_ended_by_hand(): void {
		$this->assertSame( 'stopped', RunOutcome::reason( 'stopped', 'duration' ) );
		$this->assertSame( 'stopped', RunOutcome::reason( 'stopped', 'targetDrop' ) );
	}

	/**
	 * An aborted run ended because a charger was plugged in.
	 */
	public function test_an_aborted_run_ended_because_a_charger_was_plugged_in(): void {
		$this->assertSame( 'plugged', RunOutcome::reason( 'aborted', 'duration' ) );
	}

	/**
	 * A failed run ended because a course page didn't load.
	 */
	public function test_a_failed_run_ended_with_a_load_error(): void {
		$this->assertSame( 'loadError', RunOutcome::reason( 'failed', 'targetDrop' ) );
	}

	/**
	 * A finished run completed its mode: a target-drop run hit its mark.
	 */
	public function test_a_finished_target_drop_run_hit_its_mark(): void {
		$this->assertSame( 'targetDrop', RunOutcome::reason( 'finished', 'targetDrop' ) );
	}

	/**
	 * A finished run completed its mode: a duration run ran its length.
	 */
	public function test_a_finished_duration_run_ran_its_length(): void {
		$this->assertSame( 'duration', RunOutcome::reason( 'finished', 'duration' ) );
	}
}
