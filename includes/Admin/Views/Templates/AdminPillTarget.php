<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\AdminPillView}: the target and rel attributes of a link pill.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `target` (attribute value).
 */

defined( 'ABSPATH' ) || exit;
?>
target="<?php echo esc_attr( $args['target'] ); ?>" rel="noopener noreferrer"
