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
	 * the brand on the upper arc — the cancellation is stamped by default.
	 */
	public function test_render_outputs_the_stamp_and_cancellation(): void {
		$markup = ( new FrankedStamp() )->render(
			array( 'brand' => 'BATTERY · SURF · BENCH' )
		);

		$this->assertStringContainsString( 'class="bsb-frank"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__stamp"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__cancel"', $markup );
		$this->assertStringContainsString( 'BATTERY · SURF · BENCH', $markup );
		// The watch fills these from the run; they ship empty.
		$this->assertStringContainsString( 'class="bsb-frank__arc-text"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__val"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__unit"', $markup );
	}

	/**
	 * With the cancellation disabled (the startup postcard's blank stamp), the
	 * bare perforated stamp ships with no postmark over it — the gating flag the
	 * startup card relies on.
	 */
	public function test_render_omits_the_cancellation_when_disabled(): void {
		$markup = ( new FrankedStamp() )->render(
			array( 'cancel_enabled' => false )
		);

		// The perforated stamp itself still ships.
		$this->assertStringContainsString( 'class="bsb-frank"', $markup );
		$this->assertStringContainsString( 'class="bsb-frank__stamp"', $markup );
		// …but no cancellation postmark is stamped over it.
		$this->assertStringNotContainsString( 'class="bsb-frank__cancel"', $markup );
		$this->assertStringNotContainsString( 'class="bsb-frank__arc-text"', $markup );
	}

	/**
	 * A caller can letter a fixed, non-reactive postmark server-side (the
	 * unsupported-browser warning) by passing the lower arc, value and unit, and
	 * recolour it with a modifier class — instead of leaving them for the watch.
	 */
	public function test_render_letters_a_fixed_postmark_with_a_modifier(): void {
		$markup = ( new FrankedStamp() )->render(
			array(
				'brand'    => 'BATTERY · SURF · BENCH',
				'arc'      => '· NOT SUPPORTED ·',
				'val'      => 'NO',
				'unit'     => 'BATTERY',
				'modifier' => 'bsb-frank--warning',
			)
		);

		$this->assertStringContainsString( 'class="bsb-frank bsb-frank--warning"', $markup );
		$this->assertStringContainsString( '· NOT SUPPORTED ·', $markup );
		// The centre value and unit are painted into their text nodes.
		$this->assertStringContainsString( '>NO</text>', $markup );
		$this->assertStringContainsString( '>BATTERY</text>', $markup );
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
