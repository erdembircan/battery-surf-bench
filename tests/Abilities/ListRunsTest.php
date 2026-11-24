<?php
/**
 * Tests for the list-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use DateTimeZone;
use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\ListRuns;
use ErdemBircan\BatterySurfBench\Abilities\RunFilter;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use Mockery\MockInterface;
use WP_Error;

/**
 * Behavioral tests for listing runs: the page an agent gets back, how it is
 * sorted and narrowed, and that each run is a summary.
 */
final class ListRunsTest extends TestCase {

	use AbilityContract;

	/**
	 * The reader double serving the runs.
	 *
	 * @var SessionReader&MockInterface
	 */
	private $reader;

	/**
	 * Stubs the site's clock and timezone, and the date parser.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->reader = Mockery::mock( SessionReader::class );

		Functions\when( 'wp_date' )->justReturn( '2026-11-24T12:00:00+01:00' );
		Functions\when( 'wp_timezone_string' )->justReturn( 'Europe/Berlin' );
		Functions\when( 'wp_timezone' )->justReturn( new DateTimeZone( 'Europe/Berlin' ) );
		Functions\when( 'rest_parse_date' )->alias(
			static fn ( string $value ) => 1 === preg_match( '/T.*(Z|[+-]\d{2}:\d{2})$/', $value ) ? strtotime( $value ) : false
		);
	}

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new ListRuns( $this->reader, new RunFilter() );
	}

	/**
	 * The annotations of an ability that only reads.
	 *
	 * @return array<string, bool> The annotations.
	 */
	protected function expected_annotations(): array {
		return Annotations::read();
	}

	/**
	 * Serves a number of runs, each started a day after the last.
	 *
	 * @param int $count How many runs.
	 */
	private function serve_runs( int $count ): void {
		$runs = array();

		for ( $id = 1; $id <= $count; $id++ ) {
			$runs[] = RunFixture::run(
				array(
					'id'         => $id,
					'started_at' => sprintf( '2026-10-%02dT10:00:00+01:00', $id ),
				)
			);
		}

		$this->reader->shouldReceive( 'all' )->andReturn( $runs );
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_list_runs(): void {
		$this->assertSame( 'battery-surf-bench/list-runs', $this->ability()->name() );
	}

	/**
	 * With no input the page is the 20 newest runs, and the total says how many
	 * matched before the page was cut.
	 */
	public function test_defaults_to_the_twenty_newest_runs(): void {
		$this->serve_runs( 25 );

		$result = $this->ability()->execute( array() );

		$this->assertSame( 25, $result['total'] );
		$this->assertSame( 20, $result['returned'] );
		$this->assertSame( 25, $result['runs'][0]['id'] );
		$this->assertSame( 6, $result['runs'][19]['id'] );
		$this->assertSame( '2026-11-24T12:00:00+01:00', $result['now'] );
		$this->assertSame( 'Europe/Berlin', $result['timezone'] );
	}

	/**
	 * Each run in the list is a summary: no setup, no reading count.
	 */
	public function test_each_run_is_a_summary(): void {
		$this->serve_runs( 1 );

		$run = $this->ability()->execute( array() )['runs'][0];

		$this->assertArrayNotHasKey( 'setup', $run );
		$this->assertArrayNotHasKey( 'reading_count', $run );
		$this->assertArrayHasKey( 'browser', $run );
		$this->assertArrayHasKey( 'report_url', $run );
	}

	/**
	 * The limit and offset page through the matches.
	 */
	public function test_limit_and_offset_page_through_the_matches(): void {
		$this->serve_runs( 10 );

		$result = $this->ability()->execute(
			array(
				'limit'  => 3,
				'offset' => 2,
			)
		);

		$this->assertSame( 10, $result['total'] );
		$this->assertSame( 3, $result['returned'] );
		$this->assertSame( array( 8, 7, 6 ), array_column( $result['runs'], 'id' ) );
	}

	/**
	 * A page past the end returns no runs, and still reports the total.
	 */
	public function test_an_offset_past_the_end_returns_no_runs(): void {
		$this->serve_runs( 3 );

		$result = $this->ability()->execute( array( 'offset' => 50 ) );

		$this->assertSame( 3, $result['total'] );
		$this->assertSame( 0, $result['returned'] );
		$this->assertSame( array(), $result['runs'] );
	}

	/**
	 * The order and direction sort the runs by the field chosen.
	 */
	public function test_orders_by_the_chosen_field_and_direction(): void {
		$this->reader->shouldReceive( 'all' )->andReturn(
			array(
				RunFixture::run(
					array(
						'id'                              => 1,
						'drain_rate_session_pct_per_hour' => 12.5,
					)
				),
				RunFixture::run(
					array(
						'id'                              => 2,
						'drain_rate_session_pct_per_hour' => null,
					)
				),
				RunFixture::run(
					array(
						'id'                              => 3,
						'drain_rate_session_pct_per_hour' => 9.5,
					)
				),
			)
		);

		$result = $this->ability()->execute(
			array(
				'order_by' => 'drain_rate_session',
				'order'    => 'asc',
			)
		);

		$this->assertSame( array( 3, 1, 2 ), array_column( $result['runs'], 'id' ) );
	}

	/**
	 * The filters narrow the runs before they are counted and paged.
	 */
	public function test_filters_narrow_the_runs_before_they_are_counted(): void {
		$this->reader->shouldReceive( 'all' )->andReturn(
			array(
				RunFixture::run(
					array(
						'id'     => 1,
						'status' => 'finished',
					)
				),
				RunFixture::run(
					array(
						'id'     => 2,
						'status' => 'failed',
					)
				),
				RunFixture::run(
					array(
						'id'     => 3,
						'status' => 'failed',
					)
				),
			)
		);

		$result = $this->ability()->execute( array( 'status' => array( 'failed' ) ) );

		$this->assertSame( 2, $result['total'] );
		$this->assertSame( array( 3, 2 ), array_column( $result['runs'], 'id' ) );
	}

	/**
	 * A date filter that can't be read is the agent's error to fix.
	 */
	public function test_an_unreadable_date_is_an_error(): void {
		$this->serve_runs( 1 );

		$result = $this->ability()->execute( array( 'started_after' => 'yesterday-ish' ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_invalid_date', $result->get_error_code() );
	}

	/**
	 * With no runs the list is empty, not an error.
	 */
	public function test_no_runs_is_an_empty_list(): void {
		$this->reader->shouldReceive( 'all' )->andReturn( array() );

		$result = $this->ability()->execute( array() );

		$this->assertSame( 0, $result['total'] );
		$this->assertSame( array(), $result['runs'] );
	}

	/**
	 * The input offers every filter, the order, and a bounded page.
	 */
	public function test_input_schema_offers_the_filters_order_and_paging(): void {
		$properties = $this->ability()->definition()['input_schema']['properties'];

		$this->assertSame(
			array( 'status', 'mode', 'browser', 'os', 'started_after', 'started_before', 'order_by', 'order', 'limit', 'offset' ),
			array_keys( $properties )
		);
		$this->assertSame( array( 'started_at', 'drain_rate_session', 'drain_rate_10min', 'battery_drop', 'elapsed', 'projected_runtime' ), $properties['order_by']['enum'] );
		$this->assertSame( array( 'asc', 'desc' ), $properties['order']['enum'] );
		$this->assertSame( 1, $properties['limit']['minimum'] );
		$this->assertSame( 100, $properties['limit']['maximum'] );
		$this->assertSame( 0, $properties['offset']['minimum'] );
	}
}
