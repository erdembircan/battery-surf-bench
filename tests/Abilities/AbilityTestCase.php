<?php
/**
 * Base test case for the abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use DateTimeZone;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use WP_Error;

/**
 * Shared helpers of the ability tests: error assertions and the site clock.
 */
abstract class AbilityTestCase extends TestCase {

	/**
	 * Asserts a result is an error with a code, an HTTP status and, optionally, a message.
	 *
	 * @param mixed       $result  The result.
	 * @param string      $code    The expected error code.
	 * @param int         $status  The expected HTTP status.
	 * @param string|null $message The expected message, when it is worth pinning.
	 */
	protected function assertError( mixed $result, string $code, int $status, ?string $message = null ): void {
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( $code, $result->get_error_code() );
		$this->assertSame( array( 'status' => $status ), $result->get_error_data() );

		if ( null !== $message ) {
			$this->assertSame( $message, $result->get_error_message() );
		}
	}

	/**
	 * Stubs a site in Berlin whose clock reads the same moment every time, and
	 * the RFC 3339 date parser core provides.
	 */
	protected function stub_site_time(): void {
		Functions\when( 'wp_date' )->justReturn( '2026-11-24T12:00:00+01:00' );
		Functions\when( 'wp_timezone_string' )->justReturn( 'Europe/Berlin' );
		Functions\when( 'wp_timezone' )->justReturn( new DateTimeZone( 'Europe/Berlin' ) );
		Functions\when( 'rest_parse_date' )->alias(
			static fn ( string $value ) => 1 === preg_match( '/T.*(Z|[+-]\d{2}:\d{2})$/', $value ) ? strtotime( $value ) : false
		);
	}
}
