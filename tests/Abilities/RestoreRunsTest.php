<?php
/**
 * Tests for the restore-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\RestoreRuns;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use Mockery\MockInterface;
use WP_Error;

use function has_filter;

/**
 * Behavioral tests for bringing runs back from the trash: every id is checked
 * before any run is restored, runs go back to published, and a run that can't
 * be restored is reported.
 */
final class RestoreRunsTest extends TestCase {

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
		return new RestoreRuns( $this->reader );
	}

	/**
	 * The annotations of an ability that changes things without destroying them.
	 *
	 * @return array<string, bool> The annotations.
	 */
	protected function expected_annotations(): array {
		return Annotations::write();
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_restore_runs(): void {
		$this->assertSame( 'battery-surf-bench/restore-runs', $this->ability()->name() );
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
		$this->assertSame( 1, $schema['properties']['ids']['items']['minimum'] );
	}

	/**
	 * Every run is restored, and returned as it is after restoring. While WordPress
	 * restores them they go back to the status they had, which is published, and
	 * the hook that does it is gone again afterwards.
	 */
	public function test_restores_every_run_to_its_previous_status_and_returns_them_as_they_are_now(): void {
		$trashed = RunFixture::run( array( 'id' => 4 ) );
		$this->reader->shouldReceive( 'find_trashed' )->with( 4 )->andReturn( $trashed );
		$this->reader->shouldReceive( 'find_trashed' )->with( 6 )->andReturn( RunFixture::run( array( 'id' => 6 ) ) );

		$during = array();

		Functions\expect( 'wp_untrash_post' )
			->twice()
			->andReturnUsing(
				static function () use ( &$during ) {
					$during[] = has_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status' );

					return (object) array();
				}
			);

		$this->reader->shouldReceive( 'find' )->with( 4 )->andReturn( $trashed );
		$this->reader->shouldReceive( 'find' )->with( 6 )->andReturn( RunFixture::run( array( 'id' => 6 ) ) );

		$result = $this->ability()->execute( array( 'ids' => array( 4, 6 ) ) );

		$this->assertSame( 2, $result['restored_count'] );
		$this->assertSame( array( 4, 6 ), array_column( $result['restored'], 'id' ) );
		$this->assertSame( array( 10, 10 ), $during );
		$this->assertFalse( has_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status' ) );
	}

	/**
	 * When any id isn't a run in the trash, nothing is restored, and the error names them all.
	 */
	public function test_restores_nothing_when_any_id_is_not_in_the_trash(): void {
		$this->reader->shouldReceive( 'find_trashed' )->with( 4 )->andReturn( RunFixture::run( array( 'id' => 4 ) ) );
		$this->reader->shouldReceive( 'find_trashed' )->with( 8 )->andReturn( null );
		$this->reader->shouldReceive( 'find_trashed' )->with( 9 )->andReturn( null );

		Functions\expect( 'wp_untrash_post' )->never();

		$result = $this->ability()->execute( array( 'ids' => array( 4, 8, 9 ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_restore_not_found', $result->get_error_code() );
		$this->assertSame( array( 'status' => 404 ), $result->get_error_data() );
		$this->assertSame( "These ids aren't runs in the trash: 8, 9. Nothing was restored.", $result->get_error_message() );
	}

	/**
	 * A run WordPress can't restore is a 500 naming it, the runs after it are
	 * left alone, and the status hook is removed all the same.
	 */
	public function test_a_run_that_cannot_be_restored_is_a_500(): void {
		foreach ( array( 4, 6, 7 ) as $id ) {
			$this->reader->shouldReceive( 'find_trashed' )->with( $id )->andReturn( RunFixture::run( array( 'id' => $id ) ) );
		}

		Functions\expect( 'wp_untrash_post' )->once()->with( 4 )->andReturn( (object) array() );
		Functions\expect( 'wp_untrash_post' )->once()->with( 6 )->andReturn( false );

		$result = $this->ability()->execute( array( 'ids' => array( 4, 6, 7 ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_restore_failed', $result->get_error_code() );
		$this->assertSame( array( 'status' => 500 ), $result->get_error_data() );
		$this->assertSame( "The run with the id 6 couldn't be restored. The runs before it in the list were restored.", $result->get_error_message() );
		$this->assertFalse( has_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status' ) );
	}
}
