<?php
/**
 * Tests for the YouTube embed iframe view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course\Views;

use ErdemBircan\BatterySurfBench\Course\Views\YouTubeEmbedView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The view owns the offline base iframe's markup; its `src`/`title` are
 * handed in already escaped by {@see \ErdemBircan\BatterySurfBench\Course\YouTubeEmbed}
 * (see that class's own doc comment for why), so this test only proves the
 * given values flow through into the rendered markup untouched.
 */
final class YouTubeEmbedViewTest extends TestCase {

	/**
	 * The view implements the shared markup contract.
	 */
	public function test_implements_view(): void {
		$this->assertInstanceOf( View::class, new YouTubeEmbedView() );
	}

	/**
	 * The rendered markup carries the given src and title on a single iframe.
	 */
	public function test_render_contains_the_iframe_with_the_given_src_and_title(): void {
		$html = ( new YouTubeEmbedView() )->render(
			array(
				'src'   => 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?enablejsapi=1',
				'title' => 'YouTube video player',
			)
		);

		$this->assertStringContainsString( '<iframe', $html );
		$this->assertStringContainsString(
			'src="https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?enablejsapi=1"',
			$html
		);
		$this->assertStringContainsString( 'title="YouTube video player"', $html );
		$this->assertSame( 1, substr_count( $html, '<iframe' ) );
	}

	/**
	 * The values given flow through as-is (this view does not re-escape) —
	 * the caller is responsible for escaping before handing them in.
	 */
	public function test_render_passes_the_given_values_through_unescaped(): void {
		$html = ( new YouTubeEmbedView() )->render(
			array(
				'src'   => 'already&escaped=1',
				'title' => 'already &amp; escaped',
			)
		);

		$this->assertStringContainsString( 'src="already&escaped=1"', $html );
		$this->assertStringContainsString( 'title="already &amp; escaped"', $html );
	}

	/**
	 * Missing data degrades to empty attribute values rather than a fatal
	 * error.
	 */
	public function test_render_with_no_data_degrades_to_empty_attributes(): void {
		$html = ( new YouTubeEmbedView() )->render();

		$this->assertStringContainsString( 'src=""', $html );
		$this->assertStringContainsString( 'title=""', $html );
	}
}
