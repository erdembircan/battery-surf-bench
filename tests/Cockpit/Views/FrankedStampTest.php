<?php
/**
 * Tests for the franked stamp component.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Cockpit\Views\FrankedStamp;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The franked stamp is a reusable postage stamp + cancellation; its verdict text
 * is left empty for the store's watch to paint (directives cannot live in SVG).
 */
final class FrankedStampTest extends TestCase {

	/**
	 * Consumers depend on the view contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new FrankedStamp() );
	}

	/**
	 * The stamp, cancellation rings and the watch's text targets are present, with
	 * the brand on the upper arc.
	 */
	public function test_render_outputs_the_stamp_and_cancellation(): void {
		$markup = ( new FrankedStamp() )->render(
			array( 'brand' => 'BATTERY · SURF · BENCH' )
		);

		$this->assertStringContainsString( 'class="bsb-frank"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__stamp"', $markup );
		$this->assertStringContainsString( 'BATTERY · SURF · BENCH', $markup );
		// The watch fills these from the run; they ship empty.
		$this->assertStringContainsString( 'class="bsb-frank__arc-text"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__val"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__unit"', $markup );
	}

	/**
	 * The view escapes the brand it is handed, so consumers pass a raw, translated
	 * string rather than escaping ahead of the view.
	 */
	public function test_render_escapes_the_brand(): void {
		$markup = ( new FrankedStamp() )->render(
			array( 'brand' => '<b>X</b> & "Y"' )
		);

		$this->assertStringContainsString(
			'&lt;b&gt;X&lt;/b&gt; &amp; &quot;Y&quot;',
			$markup
		);
		$this->assertStringNotContainsString( '<b>X</b>', $markup );
	}
}
