<?php
/**
 * View template renderer.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Renders a view's PHP template file to a string. A view keeps its markup in
 * template files in its `Templates/` folder: inline HTML that escapes each
 * dynamic value where it prints it. The view prepares the raw values and hands
 * them over as `$args`, the only variable a template sees besides its own path
 * in `$file`. The file's final newline is dropped, so a template renders
 * exactly the markup that follows its opening PHP block.
 */
final class Template {

	/**
	 * Renders a template file with the given values.
	 *
	 * @param string               $file Absolute path of the template file.
	 * @param array<string, mixed> $args Raw values the template escapes and prints, keyed by name.
	 * @return string The rendered markup.
	 */
	public static function render( string $file, array $args = array() ): string {
		ob_start();
		try {
			( static function () use ( $file, $args ): void {
				require $file;
			} )();
		} finally {
			$output = (string) ob_get_clean();
		}

		return str_ends_with( $output, "\n" ) ? substr( $output, 0, -1 ) : $output;
	}

	/**
	 * Prints a template file with the given values straight to the output,
	 * without buffering it. For a whole document that carries
	 * `wp_head()`/`wp_footer()` output, which can't be captured and run through
	 * `wp_kses()`. Unlike {@see Template::render()}, the file's final newline is
	 * printed too.
	 *
	 * @param string               $file Absolute path of the template file.
	 * @param array<string, mixed> $args Raw values the template escapes and prints, keyed by name.
	 * @return void
	 */
	public static function display( string $file, array $args = array() ): void {
		( static function () use ( $file, $args ): void {
			require $file;
		} )();
	}
}
