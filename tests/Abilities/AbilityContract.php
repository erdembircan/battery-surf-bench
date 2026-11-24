<?php
/**
 * Shared contract tests for the abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;

/**
 * The checks every ability must pass: a valid name in the plugin's namespace,
 * an input schema core can default and that refuses unknown input, and the
 * annotations that match what the ability does. A test class mixes this in and
 * supplies the ability and its expected annotations.
 */
trait AbilityContract {

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	abstract protected function ability(): Ability;

	/**
	 * The annotations the ability is expected to declare.
	 *
	 * @return array<string, bool> The annotations.
	 */
	abstract protected function expected_annotations(): array;

	/**
	 * A name core accepts, filed under the plugin's namespace.
	 */
	public function test_name_is_valid_and_namespaced(): void {
		$name = $this->ability()->name();

		$this->assertMatchesRegularExpression( '#^[a-z0-9-]+/[a-z0-9-]+$#', $name );
		$this->assertStringStartsWith( 'battery-surf-bench/', $name );
	}

	/**
	 * Core applies only a schema's top-level default, so the input schema must
	 * be an object that defaults to empty and refuses properties it doesn't know.
	 */
	public function test_input_schema_is_a_closed_object_that_defaults_to_empty(): void {
		$schema = $this->ability()->definition()['input_schema'];

		$this->assertSame( 'object', $schema['type'] );
		$this->assertSame( array(), $schema['default'] );
		$this->assertFalse( $schema['additionalProperties'] );
	}

	/**
	 * The annotations tell a client, and core, whether the ability reads, adds,
	 * resets or deletes.
	 */
	public function test_declares_the_annotations_of_what_it_does(): void {
		$this->assertSame( $this->expected_annotations(), $this->ability()->definition()['annotations'] );
	}

	/**
	 * A client reads the label and description to choose an ability, and the
	 * output schema to read its result.
	 */
	public function test_definition_carries_a_label_a_description_and_an_output_schema(): void {
		$definition = $this->ability()->definition();

		$this->assertNotSame( '', $definition['label'] );
		$this->assertNotSame( '', $definition['description'] );
		$this->assertSame( 'object', $definition['output_schema']['type'] );
	}
}
