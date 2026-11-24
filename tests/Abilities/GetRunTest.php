<?php
/**
 * Tests for the get-run ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\GetRun;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use Mockery\MockInterface;
use WP_Error;

/**
 * Behavioral tests for getting one run: the run asked for, or the newest, and
 * the errors for a run that isn't there.
 */
final class GetRunTest extends TestCase {

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
		return new GetRun( $this->reader );
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
	public function test_it_is_named_get_run(): void {
		$this->assertSame( 'battery-surf-bench/get-run', $this->ability()->name() );
	}

	/**
	 * The id is optional and must be a positive integer.
	 */
	public function test_the_id_is_an_optional_positive_integer(): void {
		$schema = $this->ability()->definition()['input_schema'];

		$this->assertSame( 'integer', $schema['properties']['id']['type'] );
		$this->assertSame( 1, $schema['properties']['id']['minimum'] );
		$this->assertArrayNotHasKey( 'required', $schema );
	}

	/**
	 * An id returns that run, in full.
	 */
	public function test_returns_the_run_with_the_given_id(): void {
		$run = RunFixture::run( array( 'id' => 12 ) );
		$this->reader->shouldReceive( 'find' )->with( 12 )->andReturn( $run );

		$this->assertSame( $run, $this->ability()->execute( array( 'id' => 12 ) ) );
	}

	/**
	 * With no id, the newest run is returned.
	 */
	public function test_returns_the_newest_run_when_no_id_is_given(): void {
		$run = RunFixture::run( array( 'id' => 30 ) );
		$this->reader->shouldReceive( 'newest' )->andReturn( $run );

		$this->assertSame( $run, $this->ability()->execute( array() ) );
	}

	/**
	 * With no id and no runs recorded, that is a 404 saying so.
	 */
	public function test_no_runs_recorded_is_a_404(): void {
		$this->reader->shouldReceive( 'newest' )->andReturn( null );

		$result = $this->ability()->execute( array() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_no_runs', $result->get_error_code() );
		$this->assertSame( array( 'status' => 404 ), $result->get_error_data() );
		$this->assertSame( 'No benchmark runs have been recorded yet.', $result->get_error_message() );
	}

	/**
	 * An id that isn't a recorded run is a 404 naming the id.
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
