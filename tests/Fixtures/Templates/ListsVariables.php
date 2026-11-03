<?php
/**
 * Template fixture: prints the names of the variables it can see.
 *
 * @package ErdemBircan\BatterySurfBench
 */

defined( 'ABSPATH' ) || exit;

echo esc_html( implode( ',', array_keys( get_defined_vars() ) ) );
