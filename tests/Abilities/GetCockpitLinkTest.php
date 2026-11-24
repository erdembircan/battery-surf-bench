<?php
/**
 * Tests for the get-cockpit-link ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\GetCockpitLink;

/** Behavioral tests for the cockpit link: where the cockpit and the Sessions screen are, and what a benchmark needs. */
final class GetCockpitLinkTest extends AbilityTestCase {

	/** The cockpit link serves the cockpit from the front end; the Sessions link opens the listing in wp-admin; the requirements come in order. */
	public function test_returns_the_links_and_the_requirements(): void {
		Functions\when( 'home_url' )->alias( static fn ( string $path ): string => 'https://example.test' . $path );
		Functions\when( 'admin_url' )->alias( static fn ( string $path ): string => 'https://example.test/wp-admin/' . $path );
		Functions\when( 'add_query_arg' )->alias( static fn ( string $key, string $value, string $url ): string => $url . '?' . $key . '=' . $value );

		$result = ( new GetCockpitLink( 'bsbenchSession', 'cockpit', 'bsbench-sessions' ) )->execute( array() );

		$this->assertSame( 'https://example.test/?bsbenchSession=cockpit', $result['cockpit_url'] );
		$this->assertSame( 'https://example.test/wp-admin/admin.php?page=bsbench-sessions', $result['sessions_url'] );
		$this->assertSame(
			array(
				'Open the link in a Chromium-based browser, such as Chrome, Edge or Opera: only these can read the battery level.',
				'Use the device whose battery you want to test, signed in to this site as an administrator.',
				"Unplug the charger first. A benchmark won't start while the device is charging, and plugging in during a run ends it.",
				'Keep the cockpit tab open until the run ends. The run is saved as soon as it ends.',
			),
			$result['requirements']
		);
	}
}
