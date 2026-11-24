<?php
/**
 * Tests for the trash-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Abilities\TrashRuns;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use Mockery\MockInterface;
use WP_Error;

/**
 * Behavioral tests for moving runs to the trash: every id is checked before
 * any run is moved, and a run that can't be moved is reported.
 */
final class TrashRunsTest extends TestCase {

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
		return new TrashRuns( $this->reader );
	}

	/**
	 * The annotations of an ability that destroys and can't simply be repeated.
	 *
	 * @return array<string, bool> The annotations.
	 */
	protected function expected_annotations(): array {
		return Annotations::trash();
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_trash_runs(): void {
		$this->assertSame( 'battery-surf-bench/trash-runs', $this->ability()->name() );
	}

	/**
	 * Core runs a destructive ability that isn't idempotent over POST, never DELETE.
	 */
	public function test_it_is_destructive_but_not_idempotent_so_it_runs_over_post(): void {
		$annotations = $this->ability()->definition()['annotations'];

		$this->assertTrue( $annotations['destructive'] );
		$this->assertFalse( $annotations['idempotent'] );
		$this->assertFalse( $annotations['readonly'] );
	}

	/**
	 * The ids are required, from one to a hundred, with no repeats.
	 */
	public function test_ids_are_required_one_to_a_hundred_and_unique(): void {
		$schema = $this->ability()->definition()['input_schema'];

		$this->assertSame( array( 'ids' ), $schema['required'] );
		$this->assertSame( 1, $schema['properties']['ids']['minItems'] );
		$this->assertSame( 100, $schema['properties']['ids']['maxItems'] );
		$this->assertTrue( $schema['properties']['ids']['uniqueItems'] );
	}

	/**
	 * Every run is moved to the trash, and returned as it was before.
	 */
	public function test_trashes_every_run_and_returns_them_as_they_were(): void {
		$first  = RunFixture::run( array( 'id' => 4 ) );
		$second = RunFixture::run( array( 'id' => 6 ) );
		$this->reader->shouldReceive( 'find' )->with( 4 )->andReturn( $first );
		$this->reader->shouldReceive( 'find' )->with( 6 )->andReturn( $second );

		Functions\expect( 'wp_trash_post' )->once()->with( 4 )->andReturn( (object) array() );
		Functions\expect( 'wp_trash_post' )->once()->with( 6 )->andReturn( (object) array() );

		$result = $this->ability()->execute( array( 'ids' => array( 4, 6 ) ) );

		$this->assertSame( 2, $result['trashed_count'] );
		$this->assertSame( array( $first, $second ), $result['trashed'] );
	}

	/**
	 * When any id isn't a recorded run, nothing is trashed, and the error names them all.
	 */
	public function test_trashes_nothing_when_any_id_is_unknown(): void {
		$this->reader->shouldReceive( 'find' )->with( 4 )->andReturn( RunFixture::run( array( 'id' => 4 ) ) );
		$this->reader->shouldReceive( 'find' )->with( 8 )->andReturn( null );
		$this->reader->shouldReceive( 'find' )->with( 9 )->andReturn( null );

		Functions\expect( 'wp_trash_post' )->never();

		$result = $this->ability()->execute( array( 'ids' => array( 4, 8, 9 ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_trash_not_found', $result->get_error_code() );
		$this->assertSame( array( 'status' => 404 ), $result->get_error_data() );
		$this->assertSame( "These ids aren't recorded benchmark runs: 8, 9. Nothing was moved to the trash.", $result->get_error_message() );
	}

	/**
	 * A run WordPress can't trash is a 500 naming it, and the runs after it are left alone.
	 */
	public function test_a_run_that_cannot_be_trashed_is_a_500(): void {
		$this->reader->shouldReceive( 'find' )->with( 4 )->andReturn( RunFixture::run( array( 'id' => 4 ) ) );
		$this->reader->shouldReceive( 'find' )->with( 6 )->andReturn( RunFixture::run( array( 'id' => 6 ) ) );
		$this->reader->shouldReceive( 'find' )->with( 7 )->andReturn( RunFixture::run( array( 'id' => 7 ) ) );

		Functions\expect( 'wp_trash_post' )->once()->with( 4 )->andReturn( (object) array() );
		Functions\expect( 'wp_trash_post' )->once()->with( 6 )->andReturn( false );

		$result = $this->ability()->execute( array( 'ids' => array( 4, 6, 7 ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_trash_failed', $result->get_error_code() );
		$this->assertSame( array( 'status' => 500 ), $result->get_error_data() );
		$this->assertSame( "The run with the id 6 couldn't be moved to the trash. The runs before it in the list were moved.", $result->get_error_message() );
	}
}
