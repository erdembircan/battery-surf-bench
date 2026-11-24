<?php
/**
 * Tests for the shared ability schemas.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\RunSchema;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * Behavioral tests for the schema fragments more than one ability shares.
 */
final class RunSchemaTest extends TestCase {

	/**
	 * A run in full describes every field the session reader returns, in the
	 * same order.
	 */
	public function test_detail_describes_every_field_of_a_run_in_order(): void {
		$this->assertSame( array_keys( RunFixture::run() ), array_keys( RunSchema::detail()['properties'] ) );
	}

	/**
	 * A run in the list is the full run without its setup and reading count.
	 */
	public function test_summary_is_the_run_without_setup_and_reading_count(): void {
		$expected = array_diff( array_keys( RunFixture::run() ), array( 'setup', 'reading_count' ) );

		$this->assertSame( array_values( $expected ), array_keys( RunSchema::summary()['properties'] ) );
	}

	/**
	 * A figure a run couldn't measure is declared nullable, so it validates.
	 */
	public function test_unmeasurable_figures_are_nullable(): void {
		$properties = RunSchema::detail()['properties'];

		$this->assertSame( array( 'number', 'null' ), $properties['drain_rate_session_pct_per_hour']['type'] );
		$this->assertSame( array( 'number', 'null' ), $properties['drain_rate_10min_pct_per_hour']['type'] );
		$this->assertSame( array( 'integer', 'null' ), $properties['projected_full_runtime_seconds']['type'] );
	}

	/**
	 * The filters carry a description each, and only the average's status filter
	 * defaults to finished runs.
	 */
	public function test_filters_describe_themselves_and_only_the_statistics_default_to_finished(): void {
		$list  = RunSchema::filters();
		$stats = RunSchema::filters( true );

		$this->assertSame( array( 'status', 'mode', 'browser', 'os', 'started_after', 'started_before' ), array_keys( $list ) );

		foreach ( $list as $filter ) {
			$this->assertNotSame( '', $filter['description'] );
		}

		$this->assertArrayNotHasKey( 'default', $list['status'] );
		$this->assertSame( array( 'finished' ), $stats['status']['default'] );
		$this->assertSame( array( 'finished', 'stopped', 'aborted', 'failed', 'running' ), $stats['status']['items']['enum'] );
	}

	/**
	 * The course output describes the pages, their count, the default flag and
	 * the bundled pages.
	 */
	public function test_course_describes_pages_count_default_and_bundled_pages(): void {
		$this->assertSame( array( 'pages', 'page_count', 'is_default', 'bundled_pages' ), array_keys( RunSchema::course() ) );
	}
}
