<?php
/**
 * Tests for the bark flavor text.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit;

use ErdemBircan\BatterySurfBench\Cockpit\BarkStrings;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The bark flavor text is the single source the cockpit block seeds onto its
 * context, so its consumer contract is the shape: exactly two variants for
 * every barking behavior key, with the mechanical, frequent behaviors absent.
 */
final class BarkStringsTest extends TestCase {

	/**
	 * Every barking behavior key carries exactly two non-empty flavor variants.
	 */
	public function test_provides_two_variants_for_every_barking_behavior(): void {
		$text = BarkStrings::text();

		$barking_keys = array(
			'readPause',
			'glanceBack',
			'watchVideo',
			'lingerImage',
			'selectSnippet',
			'moveOn',
		);

		foreach ( $barking_keys as $key ) {
			$this->assertArrayHasKey( $key, $text );
			$this->assertCount( 2, $text[ $key ] );

			foreach ( $text[ $key ] as $variant ) {
				$this->assertNotSame( '', $variant );
			}

			// The two variants for a key are distinct flavor text.
			$this->assertNotSame( $text[ $key ][0], $text[ $key ][1] );
		}
	}

	/**
	 * The mechanical, frequent behaviors never bark, so they carry no entry.
	 */
	public function test_omits_the_non_barking_behaviors(): void {
		$text = BarkStrings::text();

		foreach ( array( 'scrollBurst', 'microScroll', 'fidgetWiggle' ) as $key ) {
			$this->assertArrayNotHasKey( $key, $text );
		}
	}
}
