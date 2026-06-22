<?php
/**
 * Tests for the shared postcard photo component.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Cockpit\Views\PostcardPhoto;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The photo is one reusable component placed on both the idle postcard and the
 * run-summary card; its contract is the picture markup with the greeting.
 */
final class PostcardPhotoTest extends TestCase {

	/**
	 * Consumers depend on the view contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new PostcardPhoto() );
	}

	/**
	 * The photo renders the mark and the greeting from the supplied values.
	 */
	public function test_render_outputs_the_photo_and_greeting(): void {
		$markup = ( new PostcardPhoto() )->render(
			array(
				'greeting_lead' => 'Greetings from',
				'brand_title'   => 'Battery Surf Bench',
			)
		);

		$this->assertStringContainsString( 'class="bsb-photo"', $markup );
		$this->assertStringContainsString( 'class="bsb-photo__mark"', $markup );
		$this->assertStringContainsString( 'Greetings from', $markup );
		$this->assertStringContainsString( 'Battery Surf Bench', $markup );
	}

	/**
	 * A modifier class is appended so the same photo can fill a summary face.
	 */
	public function test_render_applies_a_modifier_class(): void {
		$markup = ( new PostcardPhoto() )->render(
			array( 'modifier' => 'bsb-photo--fill' )
		);

		$this->assertStringContainsString(
			'class="bsb-photo bsb-photo--fill"',
			$markup
		);
	}

	/**
	 * The view escapes the values it is handed — text with esc_html, the modifier
	 * (an attribute) with esc_attr — so consumers pass raw, translated strings.
	 */
	public function test_render_escapes_the_values_it_is_handed(): void {
		$markup = ( new PostcardPhoto() )->render(
			array(
				'greeting_lead' => 'Hi <script>',
				'brand_title'   => 'A & "B"',
				'modifier'      => 'x" onload="evil',
			)
		);

		$this->assertStringContainsString( 'Hi &lt;script&gt;', $markup );
		$this->assertStringContainsString( 'A &amp; &quot;B&quot;', $markup );
		$this->assertStringNotContainsString( '<script>', $markup );
		// The modifier lands in the class attribute, escaped, so it cannot break out.
		$this->assertStringContainsString( 'onload=&quot;evil', $markup );
		$this->assertStringNotContainsString( 'onload="evil', $markup );
	}
}
