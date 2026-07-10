<?php
/**
 * Tests for the user course page view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course\Views;

use ErdemBircan\BatterySurfBench\Course\Views\UserPageView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The view prefixes a real user page's own title onto its block content as a
 * heading, so a surfed user page stays faithful to the real page.
 */
final class UserPageViewTest extends TestCase {

	/**
	 * Consumers depend on the view contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new UserPageView() );
	}

	/**
	 * The title is rendered as an `<h1>` heading above the content, and the
	 * content itself is carried through untouched.
	 */
	public function test_render_outputs_the_title_heading_above_the_content(): void {
		$markup = ( new UserPageView() )->render(
			array(
				'title'   => 'My Custom Page',
				'content' => '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->',
			)
		);

		$this->assertStringContainsString( '<h1 class="wp-block-heading">My Custom Page</h1>', $markup );
		$this->assertStringContainsString( '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->', $markup );
		$this->assertLessThan(
			strpos( $markup, '<!-- wp:paragraph -->' ),
			strpos( $markup, '<h1 class="wp-block-heading">My Custom Page</h1>' ),
			'The title heading must precede the content.'
		);
	}

	/**
	 * The view escapes the title it is handed, so consumers pass the raw post
	 * title rather than escaping ahead of the view.
	 */
	public function test_render_escapes_the_title(): void {
		$markup = ( new UserPageView() )->render(
			array(
				'title'   => '<b>X</b> & "Y"',
				'content' => '',
			)
		);

		$this->assertStringContainsString( '&lt;b&gt;X&lt;/b&gt; &amp; &quot;Y&quot;', $markup );
		$this->assertStringNotContainsString( '<b>X</b>', $markup );
	}

	/**
	 * Missing data is tolerated: an empty title and empty content still
	 * produce a well-formed (if empty) heading.
	 */
	public function test_render_tolerates_missing_data(): void {
		$markup = ( new UserPageView() )->render();

		$this->assertStringContainsString( '<h1 class="wp-block-heading"></h1>', $markup );
	}
}
