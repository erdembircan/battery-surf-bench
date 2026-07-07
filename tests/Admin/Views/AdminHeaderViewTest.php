<?php
/**
 * Tests for the shared admin header view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin\Views;

use ErdemBircan\BatterySurfBench\Admin\Views\AdminHeaderView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The header is the one brand-header component every admin screen composes.
 * Its contract: render the mark, title, subtitle and a pre-rendered actions
 * slot, escaping only the values it owns (title/subtitle) and interpolating
 * the actions slot as-is, since that markup is already trusted.
 */
final class AdminHeaderViewTest extends TestCase {

	/**
	 * Consumers depend on the view honouring the contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new AdminHeaderView() );
	}

	/**
	 * The header renders the mark, the wordmark (title + subtitle), and the
	 * actions slot's markup interpolated as-is.
	 */
	public function test_render_outputs_mark_title_subtitle_and_actions(): void {
		$output = ( new AdminHeaderView() )->render(
			array(
				'title'    => 'Battery Surf Bench',
				'subtitle' => 'Settings',
				'actions'  => '<a class="bsb-admin-pill">New Benchmark</a>',
			)
		);

		$this->assertStringContainsString( '<header class="bsb-admin-head">', $output );
		$this->assertStringContainsString( 'bsb-admin-head__mark', $output );
		$this->assertStringContainsString( 'bsb-admin-head__wordmark', $output );
		$this->assertStringContainsString( '<h1 class="bsb-admin-head__title">Battery Surf Bench</h1>', $output );
		$this->assertStringContainsString( '<span class="bsb-admin-head__subtitle">Settings</span>', $output );
		// The actions markup is interpolated as-is, never re-escaped.
		$this->assertStringContainsString(
			'<a class="bsb-admin-pill">New Benchmark</a>',
			$output
		);
	}

	/**
	 * With nothing supplied the header still emits its structure rather than
	 * tripping on the missing values.
	 */
	public function test_render_tolerates_missing_data(): void {
		$output = ( new AdminHeaderView() )->render();

		$this->assertStringContainsString( '<header class="bsb-admin-head">', $output );
		$this->assertStringContainsString( 'bsb-admin-head__actions', $output );
	}

	/**
	 * The header escapes the title and subtitle it is handed — consumers pass
	 * raw, translated values, never pre-escaped ones.
	 */
	public function test_render_escapes_title_and_subtitle(): void {
		$output = ( new AdminHeaderView() )->render(
			array(
				'title'    => 'Settings <script>',
				'subtitle' => 'Config & "notes"',
			)
		);

		$this->assertStringContainsString( 'Settings &lt;script&gt;', $output );
		$this->assertStringNotContainsString( '<script>', $output );
		$this->assertStringContainsString( 'Config &amp; &quot;notes&quot;', $output );
	}

	/**
	 * The actions slot is composed, already-escaped markup — it must never be
	 * run through an escaper here, even when it contains characters an escaper
	 * would otherwise encode.
	 */
	public function test_render_never_re_escapes_the_actions_slot(): void {
		$actions = '<a href="https://example.test/?a=1&amp;b=2">Go</a>';

		$output = ( new AdminHeaderView() )->render( array( 'actions' => $actions ) );

		$this->assertStringContainsString( $actions, $output );
	}
}
