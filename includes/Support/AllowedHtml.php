<?php
/**
 * The HTML the plugin's views may print.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * The HTML the plugin's views may print, as a `wp_kses()` allow-list.
 *
 * Views compose markup: a parent template prints the finished markup of its
 * child views. That composed markup is printed through
 * `wp_kses( $markup, AllowedHtml::tags() )`, never echoed raw, so every piece of
 * HTML the plugin outputs passes an escaping function at the point it prints.
 *
 * The list holds exactly the elements and attributes the view templates write,
 * plus what the Interactivity API adds when it processes their directives on the
 * server: `style` from `data-wp-style--*`, and the `hidden`, `disabled`,
 * `value`, `src`, `role` and `aria-*` attributes `data-wp-bind--*` sets. A new
 * element or attribute in a template has to be added here too, or `wp_kses()`
 * strips it.
 */
final class AllowedHtml {

	/**
	 * Returns the `wp_kses()` allow-list for the elements the plugin's views
	 * render. Element and attribute names are lowercase, as kses compares them.
	 *
	 * @return array<string, array<string, bool>> Allowed attributes keyed by allowed element.
	 */
	public static function tags(): array {
		$global = array(
			'class'            => true,
			'id'               => true,
			'style'            => true,
			'hidden'           => true,
			'role'             => true,
			'title'            => true,
			'aria-hidden'      => true,
			'aria-label'       => true,
			'aria-live'        => true,
			'aria-expanded'    => true,
			'aria-pressed'     => true,
			'aria-valuemax'    => true,
			'aria-valuemin'    => true,
			'aria-valuenow'    => true,
			'aria-valuetext'   => true,
			'aria-describedby' => true,
			'aria-labelledby'  => true,
			'tabindex'         => true,
			'data-*'           => true,
		);

		$tags = array(
			'a'              => array(
				'href'   => true,
				'rel'    => true,
				'target' => true,
			),
			'aside'          => array(),
			'b'              => array(),
			'button'         => array(
				'aria-controls' => true,
				'disabled'      => true,
				'type'          => true,
				'value'         => true,
			),
			'circle'         => array(
				'cx' => true,
				'cy' => true,
				'r'  => true,
			),
			'defs'           => array(),
			'div'            => array(),
			'footer'         => array(),
			'h1'             => array(),
			'h2'             => array(),
			'header'         => array(),
			'iframe'         => array(
				'src' => true,
			),
			'input'          => array(
				'disabled' => true,
				'max'      => true,
				'min'      => true,
				'step'     => true,
				'type'     => true,
				'value'    => true,
			),
			'li'             => array(),
			'lineargradient' => array(
				'x1' => true,
				'x2' => true,
				'y1' => true,
				'y2' => true,
			),
			'ol'             => array(),
			'p'              => array(),
			'path'           => array(
				'd'    => true,
				'fill' => true,
			),
			'section'        => array(),
			'span'           => array(),
			'stop'           => array(
				'offset'     => true,
				'stop-color' => true,
			),
			'svg'            => array(
				'direction'           => true,
				'height'              => true,
				'preserveaspectratio' => true,
				'viewbox'             => true,
				'width'               => true,
			),
			'text'           => array(
				'dominant-baseline' => true,
				'text-anchor'       => true,
				'x'                 => true,
				'y'                 => true,
			),
			'textpath'       => array(
				'href'        => true,
				'startoffset' => true,
			),
		);

		return array_map(
			static fn( array $attributes ): array => array_merge( $global, $attributes ),
			$tags
		);
	}
}
