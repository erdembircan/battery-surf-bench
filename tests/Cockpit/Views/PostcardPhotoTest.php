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
}
