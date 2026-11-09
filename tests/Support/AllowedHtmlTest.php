<?php
/**
 * Tests for the plugin's kses allow-list.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Support;

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The allow-list is what `wp_kses()` lets the plugin's composed markup keep.
 * Its contract: every element carries the global attributes the Interactivity
 * API adds server-side, the bound form attributes are kept where a directive
 * sets them, and nothing that runs script or restyles the page is allowed.
 */
final class AllowedHtmlTest extends TestCase {

	/**
	 * Every allowed element keeps the attributes any view element may carry.
	 */
	public function test_every_tag_allows_the_global_attributes(): void {
		foreach ( AllowedHtml::tags() as $tag => $attributes ) {
			foreach ( array( 'class', 'style', 'hidden', 'data-*' ) as $attribute ) {
				$this->assertArrayHasKey( $attribute, $attributes, "<{$tag}> should allow {$attribute}" );
			}
		}
	}

	/**
	 * The iframe keeps the `src` the Interactivity API binds onto it.
	 */
	public function test_iframe_allows_src(): void {
		$this->assertArrayHasKey( 'src', AllowedHtml::tags()['iframe'] );
	}

	/**
	 * A button keeps the `disabled` state a directive binds onto it.
	 */
	public function test_button_allows_disabled(): void {
		$this->assertArrayHasKey( 'disabled', AllowedHtml::tags()['button'] );
	}

	/**
	 * An input keeps the `value` a directive binds onto it.
	 */
	public function test_input_allows_value(): void {
		$this->assertArrayHasKey( 'value', AllowedHtml::tags()['input'] );
	}

	/**
	 * Script and style elements never pass through the allow-list.
	 */
	public function test_script_and_style_are_not_allowed(): void {
		$tags = AllowedHtml::tags();

		$this->assertArrayNotHasKey( 'script', $tags );
		$this->assertArrayNotHasKey( 'style', $tags );
	}
}
