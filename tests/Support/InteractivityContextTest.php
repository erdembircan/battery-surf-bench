<?php
/**
 * Tests for the Interactivity context encoder.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Support;

use ErdemBircan\BatterySurfBench\Support\InteractivityContext;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The encoder turns a context array into the JSON a `data-wp-context`
 * attribute holds. Its contract: an empty context is an empty object, and
 * nothing that could break out of an attribute survives raw while the store
 * still reads the same values back.
 */
final class InteractivityContextTest extends TestCase {

	/**
	 * An empty context encodes as an empty JSON object, not an empty array.
	 */
	public function test_encode_gives_an_empty_object_for_an_empty_context(): void {
		$this->assertSame( '{}', InteractivityContext::encode( array() ) );
	}

	/**
	 * No character that could close or open markup survives raw inside a
	 * value, yet the decoded JSON is the context that went in.
	 */
	public function test_encode_leaves_no_markup_characters_raw_and_round_trips(): void {
		$context = array(
			'label' => 'Tom & "Jerry" <b>it\'s</b>',
			'count' => 3,
		);

		$encoded = InteractivityContext::encode( $context );

		foreach ( array( '&', '<', '>', "'" ) as $character ) {
			$this->assertStringNotContainsString( $character, $encoded );
		}

		// Only the quotes that delimit keys and strings stay: 2 for the `label`
		// key, 2 for its value, 2 for the `count` key.
		$this->assertSame( 6, substr_count( $encoded, '"' ) );
		$this->assertSame( $context, json_decode( $encoded, true ) );
	}
}
