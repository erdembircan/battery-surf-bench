<?php
/**
 * Tests for the translation loader.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Core;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Core\I18n;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

use function has_action;

/**
 * Behavioral tests for the translation loader: that it honours the manager
 * contract, defers loading to `init`, and points the text domain at the
 * plugin's bundled `languages` directory.
 */
final class I18nTest extends TestCase {

	private const DOMAIN      = 'battery-surf-bench';
	private const PLUGIN_FILE = '/plugins/battery-surf-bench/battery-surf-bench.php';

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, new I18n( self::DOMAIN, self::PLUGIN_FILE ) );
	}

	/**
	 * Loading is deferred to `init` — the earliest point WordPress permits
	 * translations, before which it raises a `_doing_it_wrong` notice.
	 */
	public function test_register_hooks_textdomain_loading_on_init(): void {
		$i18n = new I18n( self::DOMAIN, self::PLUGIN_FILE );
		$i18n->register();

		$this->assertNotFalse( has_action( 'init', array( $i18n, 'load_textdomain' ) ) );
	}

	/**
	 * The domain is loaded from the plugin's own `languages` directory, so its
	 * bundled translations are found rather than only the global language dir.
	 */
	public function test_load_textdomain_loads_from_the_bundled_languages_directory(): void {
		Functions\when( 'plugin_basename' )->justReturn( 'battery-surf-bench/battery-surf-bench.php' );

		Functions\expect( 'load_plugin_textdomain' )
			->once()
			->with( self::DOMAIN, false, 'battery-surf-bench/languages' );

		( new I18n( self::DOMAIN, self::PLUGIN_FILE ) )->load_textdomain();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}
}
