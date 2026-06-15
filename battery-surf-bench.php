<?php
/**
 * Plugin Name: Battery Surf Bench
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

( new BatterySurfBench( __FILE__ ) )->init();
