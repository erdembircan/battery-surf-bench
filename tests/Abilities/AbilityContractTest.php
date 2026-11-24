<?php
/**
 * Contract tests every ability must pass.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\AddCoursePage;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\CompareRuns;
use ErdemBircan\BatterySurfBench\Abilities\FindPages;
use ErdemBircan\BatterySurfBench\Abilities\GetCockpitLink;
use ErdemBircan\BatterySurfBench\Abilities\GetCourse;
use ErdemBircan\BatterySurfBench\Abilities\GetDrainStats;
use ErdemBircan\BatterySurfBench\Abilities\GetRun;
use ErdemBircan\BatterySurfBench\Abilities\GetRunReadings;
use ErdemBircan\BatterySurfBench\Abilities\ListRuns;
use ErdemBircan\BatterySurfBench\Abilities\MoveCoursePage;
use ErdemBircan\BatterySurfBench\Abilities\RemoveCoursePage;
use ErdemBircan\BatterySurfBench\Abilities\ResetCourse;
use ErdemBircan\BatterySurfBench\Abilities\RestoreRuns;
use ErdemBircan\BatterySurfBench\Abilities\RunFilter;
use ErdemBircan\BatterySurfBench\Abilities\TrashRuns;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * What every ability promises its clients: a name in the plugin's namespace
 * that core accepts, an input schema core can default and that refuses what it
 * doesn't know, annotations that match what the ability does, and the bounds
 * its inputs declare.
 */
final class AbilityContractTest extends CourseTestCase {

	/**
	 * The 14 abilities with the name and annotations each must declare.
	 *
	 * @return array<string, array{0: class-string<Ability>, 1: string, 2: array<string, bool>}> The abilities.
	 */
	public static function abilities(): array {
		return array(
			'list-runs'          => array( ListRuns::class, 'list-runs', Annotations::read() ),
			'get-run'            => array( GetRun::class, 'get-run', Annotations::read() ),
			'get-run-readings'   => array( GetRunReadings::class, 'get-run-readings', Annotations::read() ),
			'compare-runs'       => array( CompareRuns::class, 'compare-runs', Annotations::read() ),
			'get-drain-stats'    => array( GetDrainStats::class, 'get-drain-stats', Annotations::read() ),
			'trash-runs'         => array( TrashRuns::class, 'trash-runs', Annotations::trash() ),
			'restore-runs'       => array( RestoreRuns::class, 'restore-runs', Annotations::write() ),
			'get-cockpit-link'   => array( GetCockpitLink::class, 'get-cockpit-link', Annotations::read() ),
			'get-course'         => array( GetCourse::class, 'get-course', Annotations::read() ),
			'find-pages'         => array( FindPages::class, 'find-pages', Annotations::read() ),
			'add-course-page'    => array( AddCoursePage::class, 'add-course-page', Annotations::write() ),
			'move-course-page'   => array( MoveCoursePage::class, 'move-course-page', Annotations::write() ),
			'remove-course-page' => array( RemoveCoursePage::class, 'remove-course-page', Annotations::write() ),
			'reset-course'       => array( ResetCourse::class, 'reset-course', Annotations::reset() ),
		);
	}

	/**
	 * Builds an ability over a stubbed site.
	 *
	 * @param string $ability_class The ability class.
	 * @return Ability The ability.
	 */
	private function build( string $ability_class ): Ability {
		$reader = new FakeSessionReader();

		return match ( $ability_class ) {
			ListRuns::class, GetDrainStats::class => new $ability_class( $reader, new RunFilter() ),
			GetRun::class, GetRunReadings::class, CompareRuns::class, TrashRuns::class, RestoreRuns::class => new $ability_class( $reader ),
			GetCockpitLink::class => new GetCockpitLink( 'bsbenchSession', 'cockpit', 'bsbench-sessions' ),
			FindPages::class => new FindPages( $this->editor(), array( 'page', 'post' ) ),
			ResetCourse::class => new ResetCourse( $this->editor(), $this->sanitizer ),
			default => new $ability_class( $this->editor() ),
		};
	}

	/**
	 * Every ability has a valid, namespaced name, a closed input schema that
	 * defaults to empty (core applies only that top-level default), the right
	 * annotations, and a label, description and output schema a client can read.
	 *
	 * @param string              $ability_class The ability class.
	 * @param string              $name        The expected short name.
	 * @param array<string, bool> $annotations The expected annotations.
	 */
	#[DataProvider( 'abilities' )]
	public function test_the_ability_keeps_its_contract( string $ability_class, string $name, array $annotations ): void {
		$ability    = $this->build( $ability_class );
		$definition = $ability->definition();

		$this->assertSame( 'battery-surf-bench/' . $name, $ability->name() );
		$this->assertMatchesRegularExpression( '#^[a-z0-9-]+/[a-z0-9-]+$#', $ability->name() );
		$this->assertSame( 'object', $definition['input_schema']['type'] );
		$this->assertSame( array(), $definition['input_schema']['default'] );
		$this->assertFalse( $definition['input_schema']['additionalProperties'] );
		$this->assertSame( $annotations, $definition['annotations'] );
		$this->assertNotSame( '', $definition['label'] );
		$this->assertNotSame( '', $definition['description'] );
		$this->assertSame( 'object', $definition['output_schema']['type'] );
	}

	/**
	 * The bounds each ability declares for its inputs, and which it requires.
	 */
	public function test_the_inputs_declare_their_bounds(): void {
		$b      = static fn ( mixed ...$bounds ): array => $bounds;
		$bounds = array(
			array( ListRuns::class, array(), 'limit', $b( minimum: 1, maximum: 100 ) ),
			array( ListRuns::class, array(), 'offset', $b( minimum: 0 ) ),
			array( ListRuns::class, array(), 'in_trash', $b( type: 'boolean', default: false ) ),
			array( GetRun::class, array(), 'id', $b( type: 'integer', minimum: 1 ) ),
			array( GetRunReadings::class, array( 'id' ), 'id', $b( minimum: 1 ) ),
			array( CompareRuns::class, array( 'ids' ), 'ids', $b( minItems: 2, maxItems: 10, uniqueItems: true ) ),
			array( TrashRuns::class, array( 'ids' ), 'ids', $b( minItems: 1, maxItems: 100, uniqueItems: true ) ),
			array( RestoreRuns::class, array( 'ids' ), 'ids', $b( minItems: 1, maxItems: 100, uniqueItems: true ) ),
			array( FindPages::class, array(), 'limit', $b( minimum: 1, maximum: 50 ) ),
			array( AddCoursePage::class, array(), 'position', $b( minimum: 1 ) ),
			array( MoveCoursePage::class, array( 'position' ), 'position', $b( minimum: 1 ) ),
			array( AddCoursePage::class, array(), 'bundled_slug', $b( enum: array( 'article-1', 'gallery', 'article-2', 'video', 'links' ) ) ),
			array( RemoveCoursePage::class, array(), 'post_id', $b( minimum: 1 ) ),
		);

		foreach ( $bounds as list( $ability_class, $required, $property, $expected ) ) {
			$schema = $this->build( $ability_class )->definition()['input_schema'];

			$this->assertSame( $required, $schema['required'] ?? array(), $ability_class . ' requires' );
			$this->assertEquals( $expected, array_intersect_key( $schema['properties'][ $property ], $expected ), $ability_class . ' ' . $property );
		}
	}

	/**
	 * The abilities that take no input declare no properties.
	 */
	public function test_the_abilities_without_input_declare_no_properties(): void {
		foreach ( array( GetCockpitLink::class, GetCourse::class, ResetCourse::class ) as $ability_class ) {
			$this->assertSame( array(), $this->build( $ability_class )->definition()['input_schema']['properties'], $ability_class );
		}
	}
}
