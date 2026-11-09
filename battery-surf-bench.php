<?php
/**
 * Plugin Name:       Battery Surf Bench
 * Plugin URI:        https://github.com/erdembircan/battery-surf-bench
 * Description:       Benchmarks battery drain by simulating real-world web surfing.
 * Version:           1.0.0
 * Requires at least: 7.0
 * Requires PHP:      8.1
 * Author:            Erdem Bircan
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       battery-surf-bench
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

( new BatterySurfBench( __FILE__ ) )->init();
