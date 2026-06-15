<?php
/**
 * PHPUnit bootstrap.
 *
 * Defines the minimal WordPress constants the plugin guards against before
 * Brain Monkey takes over WordPress function mocking, then loads Composer's
 * autoloader.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

// Plugin source files bail with `defined( 'ABSPATH' ) || exit;`. Define it so
// classes can be autoloaded inside the test process without exiting.
if ( ! defined( 'ABSPATH' ) ) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Shimming a WordPress core constant for the test process.
	define( 'ABSPATH', sys_get_temp_dir() . '/wordpress/' );
}

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
