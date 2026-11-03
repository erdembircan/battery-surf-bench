<?php
/**
 * Tests for the view template renderer.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Support;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use RuntimeException;

/**
 * The renderer runs a template file with the values a view hands it and
 * returns the markup. Its observable contract: the template prints what it
 * escapes, a template sees only its file path and its arguments, only the
 * file's final newline is dropped, and a template that throws leaves no
 * output buffer behind.
 */
final class TemplateTest extends TestCase {

	/**
	 * Resolves a fixture template's path.
	 *
	 * @param string $name Fixture file name.
	 * @return string The fixture's absolute path.
	 */
	private function fixture( string $name ): string {
		return dirname( __DIR__ ) . '/Fixtures/Templates/' . $name;
	}

	/**
	 * A template prints the value it escapes, with the markup around it, and
	 * the rendered string ends where the markup ends.
	 */
	public function test_render_prints_the_escaped_argument_into_the_markup(): void {
		$markup = Template::render( $this->fixture( 'PrintsName.php' ), array( 'name' => 'A & "B"' ) );

		$this->assertSame( '<p class="name">A &amp; &quot;B&quot;</p>', $markup );
	}

	/**
	 * Only the file's final newline is dropped: a blank line before it stays.
	 */
	public function test_render_drops_only_the_files_final_newline(): void {
		$markup = Template::render( $this->fixture( 'TwoTrailingNewlines.php' ) );

		$this->assertSame( "<p>kept</p>\n", $markup );
	}

	/**
	 * A template sees its file path and its arguments, and nothing else.
	 */
	public function test_render_exposes_only_the_file_and_args_to_the_template(): void {
		$markup = Template::render( $this->fixture( 'ListsVariables.php' ) );

		$this->assertSame( 'file,args', $markup );
	}

	/**
	 * A template that throws propagates the exception and leaves the output
	 * buffer level where it found it.
	 */
	public function test_render_propagates_a_throwing_template_without_leaking_a_buffer(): void {
		$level = ob_get_level();

		try {
			Template::render( $this->fixture( 'Throws.php' ) );
			$this->fail( 'The template exception should propagate.' );
		} catch ( RuntimeException $exception ) {
			$this->assertSame( 'template failed', $exception->getMessage() );
		}

		$this->assertSame( $level, ob_get_level() );
	}
}
