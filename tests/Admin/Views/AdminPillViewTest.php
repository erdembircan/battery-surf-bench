<?php
/**
 * Tests for the shared admin pill view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin\Views;

use ErdemBircan\BatterySurfBench\Admin\Views\AdminPillView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The pill is the one button/link component every admin screen's header
 * composes for its actions. Its contract: a `solid` or `outline` variant,
 * rendered as a link when `href` is given (otherwise a `<button>`), with an
 * optional icon, escaping the label and href it is handed.
 */
final class AdminPillViewTest extends TestCase {

	/**
	 * Consumers depend on the view honouring the contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new AdminPillView() );
	}

	/**
	 * Given an `href`, the pill renders as a link carrying that href.
	 */
	public function test_render_with_href_outputs_a_link(): void {
		$output = ( new AdminPillView() )->render(
			array(
				'label' => 'New Benchmark',
				'href'  => 'https://example.test/?bsbSession=cockpit',
			)
		);

		$this->assertStringContainsString( '<a class="bsb-admin-pill bsb-admin-pill--solid"', $output );
		$this->assertStringContainsString( 'href="https://example.test/?bsbSession=cockpit"', $output );
		$this->assertStringContainsString( 'New Benchmark', $output );
		$this->assertStringNotContainsString( '<button', $output );
	}

	/**
	 * Without an `href`, the pill renders as a button — the shape the React
	 * Save button's PHP-rendered counterpart (if any) would take.
	 */
	public function test_render_without_href_outputs_a_button(): void {
		$output = ( new AdminPillView() )->render( array( 'label' => 'Save changes' ) );

		$this->assertStringContainsString( '<button type="button" class="bsb-admin-pill bsb-admin-pill--solid">', $output );
		$this->assertStringContainsString( 'Save changes', $output );
		$this->assertStringNotContainsString( '<a ', $output );
	}

	/**
	 * The `variant` prop selects the pill's modifier class; an unrecognized or
	 * missing variant falls back to `solid`, the page's primary action.
	 */
	public function test_variant_selects_the_modifier_class(): void {
		$outline  = ( new AdminPillView() )->render(
			array(
				'label'   => 'New Benchmark',
				'variant' => 'outline',
			)
		);
		$solid    = ( new AdminPillView() )->render(
			array(
				'label'   => 'Save changes',
				'variant' => 'solid',
			)
		);
		$fallback = ( new AdminPillView() )->render(
			array(
				'label'   => 'Save changes',
				'variant' => 'not-a-real-variant',
			)
		);

		$this->assertStringContainsString( 'bsb-admin-pill--outline', $outline );
		$this->assertStringNotContainsString( 'bsb-admin-pill--solid', $outline );
		$this->assertStringContainsString( 'bsb-admin-pill--solid', $solid );
		$this->assertStringContainsString( 'bsb-admin-pill--solid', $fallback );
	}

	/**
	 * A `target` is only emitted (with the accompanying `rel`) when the pill is
	 * a link; a button never carries one.
	 */
	public function test_target_is_emitted_only_for_a_link(): void {
		$link = ( new AdminPillView() )->render(
			array(
				'label'  => 'New Benchmark',
				'href'   => 'https://example.test/',
				'target' => '_blank',
			)
		);

		$this->assertStringContainsString( 'target="_blank"', $link );
		$this->assertStringContainsString( 'rel="noopener noreferrer"', $link );
	}

	/**
	 * An `icon` renders an aria-hidden icon span carrying the icon's modifier
	 * class; omitting it renders no icon markup at all.
	 */
	public function test_icon_renders_a_modifier_span_when_given(): void {
		$with_icon    = ( new AdminPillView() )->render(
			array(
				'label' => 'New Benchmark',
				'icon'  => 'external',
			)
		);
		$without_icon = ( new AdminPillView() )->render( array( 'label' => 'Save changes' ) );

		$this->assertStringContainsString(
			'<span class="bsb-admin-pill__icon bsb-admin-pill__icon--external" aria-hidden="true"></span>',
			$with_icon
		);
		$this->assertStringNotContainsString( 'bsb-admin-pill__icon', $without_icon );
	}

	/**
	 * The pill escapes the label and href it is handed — consumers pass raw,
	 * translated values, never pre-escaped ones.
	 */
	public function test_render_escapes_label_and_href(): void {
		$output = ( new AdminPillView() )->render(
			array(
				'label' => 'New & "Benchmark"',
				'href'  => 'https://example.test/?a="b"',
			)
		);

		$this->assertStringContainsString( 'New &amp; &quot;Benchmark&quot;', $output );
		$this->assertStringContainsString( 'href="https://example.test/?a=&quot;b&quot;"', $output );
	}

	/**
	 * With nothing supplied the pill still renders a (labelless) button rather
	 * than tripping on the missing values.
	 */
	public function test_render_tolerates_missing_data(): void {
		$output = ( new AdminPillView() )->render();

		$this->assertStringContainsString( '<button type="button" class="bsb-admin-pill bsb-admin-pill--solid">', $output );
	}
}
