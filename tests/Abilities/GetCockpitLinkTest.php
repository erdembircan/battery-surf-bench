<?php
/**
 * Tests for the get-cockpit-link ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\GetCockpitLink;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * Behavioral tests for the cockpit link: where the cockpit and the Sessions
 * screen are, and what a benchmark needs.
 */
final class GetCockpitLinkTest extends TestCase {

	use AbilityContract;

	/**
	 * Stubs the URL helpers.
	 */
	protected function setUp(): void {
		parent::setUp();

		Functions\when( 'home_url' )->alias( static fn ( string $path ): string => 'https://example.test' . $path );
		Functions\when( 'admin_url' )->alias( static fn ( string $path ): string => 'https://example.test/wp-admin/' . $path );
		Functions\when( 'add_query_arg' )->alias( static fn ( string $key, string $value, string $url ): string => $url . '?' . $key . '=' . $value );
	}

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new GetCockpitLink( 'bsbenchSession', 'cockpit', 'bsbench-sessions' );
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
	public function test_it_is_named_get_cockpit_link(): void {
		$this->assertSame( 'battery-surf-bench/get-cockpit-link', $this->ability()->name() );
	}

	/**
	 * It takes no input.
	 */
	public function test_it_takes_no_input(): void {
		$this->assertSame( array(), $this->ability()->definition()['input_schema']['properties'] );
	}

	/**
	 * The cockpit link serves the cockpit from the site's front end, and the
	 * Sessions link opens the listing in wp-admin.
	 */
	public function test_returns_the_cockpit_and_sessions_links(): void {
		$result = $this->ability()->execute( array() );

		$this->assertSame( 'https://example.test/?bsbenchSession=cockpit', $result['cockpit_url'] );
		$this->assertSame( 'https://example.test/wp-admin/admin.php?page=bsbench-sessions', $result['sessions_url'] );
	}

	/**
	 * It lists what a benchmark needs, in order.
	 */
	public function test_returns_the_requirements_in_order(): void {
		$this->assertSame(
			array(
				'Open the link in a Chromium-based browser, such as Chrome, Edge or Opera: only these can read the battery level.',
				'Use the device whose battery you want to test, signed in to this site as an administrator.',
				"Unplug the charger first. A benchmark won't start while the device is charging, and plugging in during a run ends it.",
				'Keep the cockpit tab open until the run ends. The run is saved as soon as it ends.',
			),
			$this->ability()->execute( array() )['requirements']
		);
	}
}
