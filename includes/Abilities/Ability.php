<?php
/**
 * Ability contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Describes and runs a single ability registered with the WordPress Abilities
 * API: its name, its definition (label, description, schemas and annotations)
 * and the work it does.
 *
 * {@see AbilityRegistry} calls {@see self::definition()} from inside its own
 * Abilities API callbacks, never at composition time — a definition calls
 * `__()` for its label, description and schema descriptions, and `__()` must
 * not run before `init` fires. Implementations should build the definition
 * fresh on every call rather than caching it from the constructor, so nothing
 * inside it executes before the registry actually asks for it.
 */
interface Ability {

	/**
	 * The ability's registered name, namespaced like `battery-surf-bench/list-runs`.
	 *
	 * @return string The ability name.
	 */
	public function name(): string;

	/**
	 * Builds this ability's definition: the translated label and description, the
	 * input and output JSON schemas, and the annotations that tell a client
	 * whether it only reads, deletes or changes things.
	 *
	 * @return array{label: string, description: string, input_schema: array<string, mixed>, output_schema: array<string, mixed>, annotations: array<string, bool>} The ability definition.
	 */
	public function definition(): array;

	/**
	 * Runs the ability with its validated input.
	 *
	 * @param array<string, mixed> $input The validated input, or an empty array when none was given.
	 * @return array<string, mixed>|WP_Error The result matching the output schema, or an error carrying an HTTP status.
	 */
	public function execute( array $input ): array|WP_Error;
}
