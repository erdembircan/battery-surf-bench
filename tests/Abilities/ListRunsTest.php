<?php
/**
 * Tests for the list-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\ListRuns;
use ErdemBircan\BatterySurfBench\Abilities\RunFilter;

/** Behavioral tests for listing runs: the page an agent gets back, how it is sorted and narrowed. */
final class ListRunsTest extends AbilityTestCase {

	/** Stubs the site's clock, timezone and date parser. */
	protected function setUp(): void {
		parent::setUp();

		$this->stub_site_time();
	}

	/**
	 * Builds the ability over runs, each started a day after the last.
	 *
	 * @param int $count How many recorded runs.
	 * @return ListRuns The ability.
	 */
	private function list_of( int $count ): ListRuns {
		$runs = array();

		for ( $id = 1; $id <= $count; $id++ ) {
			$runs[] = RunFixture::run( id: $id, started_at: sprintf( '2026-10-%02dT10:00:00+01:00', $id ) );
		}

		return new ListRuns( new FakeSessionReader( $runs ), new RunFilter() );
	}

	/** With no input the page is the 20 newest runs, each a summary with its setup but no reading count. */
	public function test_defaults_to_the_twenty_newest_runs_as_summaries(): void {
		$result = $this->list_of( 25 )->execute( array() );

		$this->assertSame( 25, $result['total'] );
		$this->assertSame( 20, $result['returned'] );
		$this->assertSame( 25, $result['runs'][0]['id'] );
		$this->assertSame( 6, $result['runs'][19]['id'] );
		$this->assertSame( '2026-11-24T12:00:00+01:00', $result['now'] );
		$this->assertSame( 'Europe/Berlin', $result['timezone'] );
		$this->assertArrayHasKey( 'setup', $result['runs'][0] );
		$this->assertArrayHasKey( 'browser', $result['runs'][0] );
		$this->assertArrayNotHasKey( 'reading_count', $result['runs'][0] );
	}

	/** The limit and offset page through the matches; a page past the end is empty but still reports the total. */
	public function test_limit_and_offset_page_through_the_matches(): void {
		$list = $this->list_of( 10 );
		$page = $list->execute(
			array(
				'limit'  => 3,
				'offset' => 2,
			)
		);

		$this->assertSame( 10, $page['total'] );
		$this->assertSame( array( 8, 7, 6 ), array_column( $page['runs'], 'id' ) );

		$past = $list->execute( array( 'offset' => 50 ) );

		$this->assertSame( array( 10, 0, array() ), array( $past['total'], $past['returned'], $past['runs'] ) );
	}

	/** The order and direction sort by the field chosen, with unmeasured runs last. */
	public function test_orders_by_the_chosen_field_and_direction(): void {
		$runs = array(
			RunFixture::run( id: 1, drain_rate_session_pct_per_hour: 12.5 ),
			RunFixture::run( id: 2, drain_rate_session_pct_per_hour: null ),
			RunFixture::run( id: 3, drain_rate_session_pct_per_hour: 9.5 ),
		);
		$list = new ListRuns( new FakeSessionReader( $runs ), new RunFilter() );

		$result = $list->execute(
			array(
				'order_by' => 'drain_rate_session',
				'order'    => 'asc',
			)
		);

		$this->assertSame( array( 3, 1, 2 ), array_column( $result['runs'], 'id' ) );
	}

	/** Filters narrow the runs before they are counted; a date that can't be read is the agent's error to fix. */
	public function test_filters_narrow_the_runs_and_a_bad_date_is_an_error(): void {
		$runs = array( RunFixture::run( id: 1 ), RunFixture::run( id: 2, status: 'failed' ), RunFixture::run( id: 3, status: 'failed' ) );
		$list = new ListRuns( new FakeSessionReader( $runs ), new RunFilter() );

		$result = $list->execute( array( 'status' => array( 'failed' ) ) );

		$this->assertSame( 2, $result['total'] );
		$this->assertSame( array( 3, 2 ), array_column( $result['runs'], 'id' ) );
		$this->assertError( $list->execute( array( 'started_after' => 'yesterday-ish' ) ), 'bsbench_invalid_date', 400 );
	}

	/** By default the recorded runs are listed; with `in_trash` the trashed ones are, through the same filters. */
	public function test_in_trash_lists_the_runs_in_the_trash_instead(): void {
		$trashed = array( RunFixture::run( id: 2, status: 'failed' ), RunFixture::run( id: 3 ) );
		$list    = new ListRuns( new FakeSessionReader( array( RunFixture::run( id: 1 ) ), $trashed ), new RunFilter() );

		$this->assertSame( array( 1 ), array_column( $list->execute( array() )['runs'], 'id' ) );
		$this->assertSame(
			array( 2 ),
			array_column(
				$list->execute(
					array(
						'in_trash' => true,
						'status'   => array( 'failed' ),
					)
				)['runs'],
				'id'
			)
		);
		$this->assertSame( array( 3, 2 ), array_column( $list->execute( array( 'in_trash' => 'true' ) )['runs'], 'id' ) );
	}

	/** With no runs the list is empty, not an error. */
	public function test_no_runs_is_an_empty_list(): void {
		$result = $this->list_of( 0 )->execute( array() );

		$this->assertSame( array( 0, array() ), array( $result['total'], $result['runs'] ) );
	}
}
