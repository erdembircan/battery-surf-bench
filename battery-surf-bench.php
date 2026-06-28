<?php
/**
 * Plugin Name:       Battery Surf Bench
 * Plugin URI:        https://github.com/erdembircan/battery-surf-bench
 * Description:       Benchmarks battery drain by simulating real-world web surfing.
 * Version:           1.0.0-dev
 * Requires at least: 7.0
 * Requires PHP:      8.1
 * Author:            Erdem Bircan
 * License:           Apache-2.0
 * License URI:       https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain:       battery-surf-bench
 * Domain Path:       /languages
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Content\SessionType;

use function register_activation_hook;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

// The session post type carries a rewrite (its single-post permalink), so its
// rules must be flushed once after activation. The type is not registered yet
// when this hook fires; it flags a one-shot flush the next `init` performs once
// the type — and its rewrite rules — exist.
register_activation_hook( __FILE__, array( SessionType::class, 'activate' ) );

( new BatterySurfBench( __FILE__ ) )->init();
