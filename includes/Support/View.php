<?php
/**
 * View contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * A self-contained piece of markup. A view owns its HTML — kept inside the
 * implementation as a heredoc, never written inline in the surrounding PHP — and
 * turns the data it is handed into a finished, ready-to-print string. Consumers
 * (a manager, a block render template) supply the dynamic, already-escaped
 * values and place the returned markup; they never assemble HTML themselves.
 */
interface View {

	/**
	 * Renders the view to an HTML string.
	 *
	 * @param array<string, mixed> $data Already-escaped values the view interpolates into its markup.
	 * @return string The rendered HTML.
	 */
	public function render( array $data = array() ): string;
}
