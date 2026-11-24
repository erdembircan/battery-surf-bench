<?php
/**
 * Tests for the get-run-readings ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\GetRunReadings;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use Mockery\MockInterface;
use WP_Error;

/**
 * Behavioral tests for getting a run's readings.
 */
final class GetRunReadingsTest extends TestCase {

	use AbilityContract;

	/**
	 * The reader double serving the runs.
	 *
	 * @var SessionReader&MockInterface
	 */
	private $reader;

	/**
	 * Builds the reader double.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->reader = Mockery::mock( SessionReader::class );
	}

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new GetRunReadings( $this->reader );
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
	 * The ability's registered name.
	 */
	public function test_it_is_named_get_run_readings(): void {
		$this->assertSame( 'battery-surf-bench/get-run-readings', $this->ability()->name() );
	}

	/**
	 * The id is required.
	 */
	public function test_the_id_is_required(): void {
		$this->assertSame( array( 'id' ), $this->ability()->definition()['input_schema']['required'] );
	}

	/**
	 * The run's readings come back with their count.
	 */
	public function test_returns_the_readings_with_their_count(): void {
		$readings = array(
			array(
				'elapsed_seconds' => 0.0,
				'battery_percent' => 98.0,
				'charging'        => false,
				'repeat_count'    => 3,
			),
			array(
				'elapsed_seconds' => 360.0,
				'battery_percent' => 97.0,
				'charging'        => false,
				'repeat_count'    => 3,
			),
		);
		$this->reader->shouldReceive( 'find' )->with( 12 )->andReturn( RunFixture::run( array( 'id' => 12 ) ) );
		$this->reader->shouldReceive( 'readings' )->with( 12 )->andReturn( $readings );

		$this->assertSame(
			array(
				'id'            => 12,
				'reading_count' => 2,
				'readings'      => $readings,
			),
			$this->ability()->execute( array( 'id' => 12 ) )
		);
	}

	/**
	 * A run that isn't recorded is a 404 naming the id.
	 */
	public function test_an_unknown_id_is_a_404(): void {
		$this->reader->shouldReceive( 'find' )->with( 99 )->andReturn( null );

		$result = $this->ability()->execute( array( 'id' => 99 ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_run_not_found', $result->get_error_code() );
		$this->assertSame( array( 'status' => 404 ), $result->get_error_data() );
		$this->assertSame( "There's no benchmark run with the id 99.", $result->get_error_message() );
	}
}
