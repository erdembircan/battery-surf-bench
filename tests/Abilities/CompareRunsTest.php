<?php
/**
 * Tests for the compare-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\CompareRuns;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use Mockery\MockInterface;
use WP_Error;

/**
 * Behavioral tests for comparing runs side by side.
 */
final class CompareRunsTest extends TestCase {

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
		return new CompareRuns( $this->reader );
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
	public function test_it_is_named_compare_runs(): void {
		$this->assertSame( 'battery-surf-bench/compare-runs', $this->ability()->name() );
	}

	/**
	 * The ids are required, from two to ten, with no repeats.
	 */
	public function test_ids_are_required_two_to_ten_and_unique(): void {
		$schema = $this->ability()->definition()['input_schema'];

		$this->assertSame( array( 'ids' ), $schema['required'] );
		$this->assertSame( 2, $schema['properties']['ids']['minItems'] );
		$this->assertSame( 10, $schema['properties']['ids']['maxItems'] );
		$this->assertTrue( $schema['properties']['ids']['uniqueItems'] );
	}

	/**
	 * The runs come back in the order they were asked for, not the order they were recorded.
	 */
	public function test_returns_the_runs_in_the_order_given(): void {
		$this->reader->shouldReceive( 'find' )->with( 9 )->andReturn( RunFixture::run( array( 'id' => 9 ) ) );
		$this->reader->shouldReceive( 'find' )->with( 3 )->andReturn( RunFixture::run( array( 'id' => 3 ) ) );

		$result = $this->ability()->execute( array( 'ids' => array( 9, 3 ) ) );

		$this->assertSame( array( 9, 3 ), array_column( $result['runs'], 'id' ) );
	}

	/**
	 * Every id that isn't a recorded run is named in one 404.
	 */
	public function test_names_every_unknown_id(): void {
		$this->reader->shouldReceive( 'find' )->with( 1 )->andReturn( RunFixture::run( array( 'id' => 1 ) ) );
		$this->reader->shouldReceive( 'find' )->with( 8 )->andReturn( null );
		$this->reader->shouldReceive( 'find' )->with( 9 )->andReturn( null );

		$result = $this->ability()->execute( array( 'ids' => array( 8, 1, 9 ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_compare_not_found', $result->get_error_code() );
		$this->assertSame( array( 'status' => 404 ), $result->get_error_data() );
		$this->assertSame( "These ids aren't recorded benchmark runs: 8, 9.", $result->get_error_message() );
	}
}
