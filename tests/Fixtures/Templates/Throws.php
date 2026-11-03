<?php
/**
 * Template fixture: prints some markup, then throws.
 *
 * @package ErdemBircan\BatterySurfBench
 */

defined( 'ABSPATH' ) || exit;
?>
<p>partial output before the failure</p>
<?php throw new RuntimeException( 'template failed' ); ?>
