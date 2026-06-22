<?php
/**
 * Base test case.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase as PHPUnitTestCase;

/**
 * Base test case that wires Brain Monkey's WordPress mocking into the
 * PHPUnit lifecycle.
 */
abstract class TestCase extends PHPUnitTestCase {

	/**
	 * Sets up Brain Monkey and stubs common WordPress escaping and i18n
	 * helpers so code under test can call them without a loaded WordPress.
	 */
	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();

		// Escapers behave like WordPress' (htmlspecialchars with ENT_QUOTES), so
		// tests can assert a view actually escapes the values it is handed. esc_url
		// uses the same stand-in — enough to prove the view routes URLs through it.
		$escape = static fn( $value ): string => htmlspecialchars( (string) $value, ENT_QUOTES );
		Functions\when( 'esc_html' )->alias( $escape );
		Functions\when( 'esc_attr' )->alias( $escape );
		Functions\when( 'esc_url' )->alias( $escape );

		// Translation helpers pass their text through unchanged.
		Functions\when( 'esc_html__' )->returnArg();
		Functions\when( 'esc_attr__' )->returnArg();
		Functions\when( '__' )->returnArg();
	}

	/**
	 * Tears down Brain Monkey after each test.
	 */
	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}
}
