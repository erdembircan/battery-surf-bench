<?php
/**
 * Tests for the shared flip postcard component.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Cockpit\Views\FlipPostcard;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The flip postcard is the shared two-faced card the startup screen and the run
 * summary both reuse: it places the given face contents, wires a flip badge on
 * each face to the consumer's action, and binds the flipped class to the
 * consumer's store field.
 */
final class FlipPostcardTest extends TestCase {

	/**
	 * Consumers depend on the view contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new FlipPostcard() );
	}

	/**
	 * The card places both faces' contents, binds the flip class to the given
	 * store field, and wires a flip badge on each face to the given action.
	 */
	public function test_render_builds_both_faces_and_wires_the_flip(): void {
		$markup = ( new FlipPostcard() )->render(
			array(
				'front'       => '<span class="front-content"></span>',
				'back'        => '<span class="back-content"></span>',
				'flip_label'  => 'Flip',
				'flip_action' => 'actions.toggleIdleFlip',
				'flip_state'  => 'state.isIdleFlipped',
				'modifier'    => 'bsb-flipcard--idle',
			)
		);

		// The card binds the flipped class to the consumer's field and carries the
		// modifier.
		$this->assertStringContainsString( 'class="bsb-flipcard bsb-flipcard--idle" data-wp-class--is-flipped="state.isIdleFlipped"', $markup );
		// The turning element is an inner wrapper (the outer card owns the
		// perspective; the inner holds the 3D rotation), so the faces nest inside it.
		$this->assertStringContainsString( 'class="bsb-flipcard__inner"', $markup );
		// Both faces, with the given contents placed verbatim.
		$this->assertStringContainsString( 'class="bsb-flipcard__face bsb-flipcard__face--front"', $markup );
		$this->assertStringContainsString( 'class="bsb-flipcard__face bsb-flipcard__face--back"', $markup );
		$this->assertStringContainsString( '<span class="front-content"></span>', $markup );
		$this->assertStringContainsString( '<span class="back-content"></span>', $markup );
		// A flip badge on each face wires the given action; the back's is ink-toned.
		$this->assertSame( 2, substr_count( $markup, 'data-wp-on--click="actions.toggleIdleFlip"' ) );
		$this->assertStringContainsString( 'class="bsb-flipcard__flip"', $markup );
		$this->assertStringContainsString( 'class="bsb-flipcard__flip bsb-flipcard__flip--paper"', $markup );
		$this->assertSame( 2, substr_count( $markup, '>Flip</button>' ) );
	}

	/**
	 * The view escapes its own slots — the flip label (text) and the directive
	 * attributes — so consumers pass raw values. Face contents arrive as
	 * already-escaped child markup and are placed as-is.
	 */
	public function test_render_escapes_its_own_slots(): void {
		$markup = ( new FlipPostcard() )->render(
			array(
				'front'       => '<span class="front-content"></span>',
				'back'        => '<span class="back-content"></span>',
				'flip_label'  => '<b>Flip</b>',
				'flip_action' => 'actions.toggleFlip',
				'flip_state'  => 'state.isFlipped',
			)
		);

		$this->assertStringContainsString( '&lt;b&gt;Flip&lt;/b&gt;', $markup );
		$this->assertStringNotContainsString( '<b>Flip</b>', $markup );
		// The face contents are placed verbatim (already escaped by their views).
		$this->assertStringContainsString( '<span class="front-content"></span>', $markup );
	}

	/**
	 * Both faces cluster their flip badge in a shared, absolutely-placed corner
	 * so the badge sits in the same spot on every face. An optional back_actions
	 * slot (e.g. the cockpit's "New run" button) is placed in the back face's
	 * corner, before the flip badge, so the two read as one aligned pair — it
	 * never leaks onto the front face.
	 */
	public function test_render_places_back_actions_in_the_back_corner(): void {
		$markup = ( new FlipPostcard() )->render(
			array(
				'front'        => '<span class="front-content"></span>',
				'back'         => '<span class="back-content"></span>',
				'flip_label'   => 'Flip',
				'flip_action'  => 'actions.toggleFlip',
				'flip_state'   => 'state.isFlipped',
				'back_actions' => '<button class="probe-action"></button>',
			)
		);

		// Both faces wrap their flip badge in the shared corner.
		$this->assertSame( 2, substr_count( $markup, 'class="bsb-flipcard__corner"' ) );
		// The probe appears exactly once, inside the back face's corner, ahead of
		// the flip badge.
		$this->assertSame( 1, substr_count( $markup, 'probe-action' ) );
		$this->assertStringContainsString( '<div class="bsb-flipcard__corner"><button class="probe-action"></button><button type="button" class="bsb-flipcard__flip bsb-flipcard__flip--paper"', $markup );
	}

	/**
	 * Without a back_actions slot, the front and back corners hold nothing but
	 * their own flip badge — no stray markup leaks in.
	 */
	public function test_render_without_back_actions_leaves_corners_bare(): void {
		$markup = ( new FlipPostcard() )->render(
			array(
				'front'       => '<span class="front-content"></span>',
				'back'        => '<span class="back-content"></span>',
				'flip_label'  => 'Flip',
				'flip_action' => 'actions.toggleFlip',
				'flip_state'  => 'state.isFlipped',
			)
		);

		$this->assertStringContainsString( '<div class="bsb-flipcard__corner"><button type="button" class="bsb-flipcard__flip"', $markup );
		$this->assertStringContainsString( '<div class="bsb-flipcard__corner"><button type="button" class="bsb-flipcard__flip bsb-flipcard__flip--paper"', $markup );
	}
}
