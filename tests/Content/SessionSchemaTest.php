<?php
/**
 * Tests for the benchmark session data shape.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * Behavioral tests for the session schema's public contract: the meta it hands
 * the registration layer and the field descriptors it hands the listing screen.
 */
final class SessionSchemaTest extends TestCase {

	private const POST_TYPE = 'bsb_session';
	private const PREFIX    = 'bsb_';

	/**
	 * Builds a schema with representative post type and prefix.
	 *
	 * @return SessionSchema The schema under test.
	 */
	private function schema(): SessionSchema {
		return new SessionSchema( self::POST_TYPE, self::PREFIX );
	}

	/**
	 * Consumers query the schema for the post type sessions are stored as.
	 */
	public function test_post_type_returns_the_configured_type(): void {
		$this->assertSame( self::POST_TYPE, $this->schema()->post_type() );
	}

	/**
	 * Every meta key the schema registers is namespaced with the prefix, so the
	 * session's data never collides with other plugins' meta.
	 */
	public function test_meta_keys_are_prefixed(): void {
		foreach ( array_keys( $this->schema()->metas() ) as $key ) {
			$this->assertStringStartsWith( self::PREFIX, $key );
		}
	}

	/**
	 * Each meta is registered as a single, REST-exposed value with a sanitizer,
	 * which is what lets the post type's own endpoint surface it safely.
	 */
	public function test_metas_are_single_rest_exposed_and_sanitized(): void {
		foreach ( $this->schema()->metas() as $args ) {
			$this->assertTrue( $args['single'] );
			$this->assertArrayHasKey( 'show_in_rest', $args );
			$this->assertNotFalse( $args['show_in_rest'] );
			$this->assertTrue(
				is_string( $args['sanitize_callback'] ) || is_array( $args['sanitize_callback'] )
			);
		}
	}

	/**
	 * The schema owns the data shape, not the access policy: it never bakes an
	 * auth callback into a meta — that is the post type manager's job.
	 */
	public function test_metas_carry_no_auth_policy(): void {
		foreach ( $this->schema()->metas() as $args ) {
			$this->assertArrayNotHasKey( 'auth_callback', $args );
		}
	}

	/**
	 * An enumerated field constrains its REST schema to the allowed values, so
	 * an out-of-range status or mode is rejected at the endpoint.
	 */
	public function test_enumerated_meta_constrains_its_rest_values(): void {
		$status = $this->schema()->metas()[ self::PREFIX . 'status' ];

		$this->assertSame(
			array( 'running', 'finished', 'stopped', 'aborted' ),
			$status['show_in_rest']['schema']['enum']
		);
	}

	/**
	 * WordPress validates a registered default against the meta's schema, so an
	 * enumerated meta must never register a default outside its allowed values —
	 * doing so emits a notice at registration time. Such fields are always set
	 * when a session is created, so they register no default at all.
	 */
	public function test_enumerated_meta_never_defaults_outside_its_values(): void {
		$enumerated = 0;

		foreach ( $this->schema()->metas() as $args ) {
			if ( ! is_array( $args['show_in_rest'] ) ) {
				continue;
			}

			$enum = $args['show_in_rest']['schema']['enum'] ?? null;
			if ( null === $enum ) {
				continue;
			}

			++$enumerated;

			if ( array_key_exists( 'default', $args ) ) {
				$this->assertContains( $args['default'], $enum );
			}
		}

		$this->assertGreaterThan( 0, $enumerated );
	}

	/**
	 * Field descriptors name the prefixed meta key the REST record exposes, so
	 * the listing reads each value straight from `meta` by that key.
	 */
	public function test_field_descriptors_reference_prefixed_keys(): void {
		foreach ( $this->schema()->fields() as $field ) {
			$this->assertStringStartsWith( self::PREFIX, $field['key'] );
			$this->assertArrayHasKey( 'label', $field );
			$this->assertArrayHasKey( 'format', $field );
		}
	}

	/**
	 * An enumerated field exposes its selectable values to the listing as the
	 * value/label objects DataViews expects.
	 */
	public function test_enumerated_field_exposes_value_label_elements(): void {
		$mode = $this->fieldFor( self::PREFIX . 'mode' );

		$this->assertContains(
			array(
				'value' => 'duration',
				'label' => 'Duration',
			),
			$mode['elements']
		);
	}

	/**
	 * The default columns are a non-empty subset of the registered meta, all
	 * prefixed, so the listing opens on real fields.
	 */
	public function test_default_columns_are_registered_meta_keys(): void {
		$schema  = $this->schema();
		$columns = $schema->default_columns();
		$metas   = array_keys( $schema->metas() );

		$this->assertNotEmpty( $columns );

		foreach ( $columns as $column ) {
			$this->assertContains( $column, $metas );
		}
	}

	/**
	 * Battery levels are clamped to the 0..1 fraction the cockpit reports,
	 * guarding the meta against out-of-range writes.
	 */
	public function test_sanitize_level_clamps_to_unit_interval(): void {
		$this->assertSame( 1.0, SessionSchema::sanitize_level( 2 ) );
		$this->assertSame( 0.0, SessionSchema::sanitize_level( -0.5 ) );
		$this->assertSame( 0.5, SessionSchema::sanitize_level( 0.5 ) );
	}

	/**
	 * Drain rates are coerced to non-negative numbers.
	 */
	public function test_sanitize_rate_rejects_negatives(): void {
		$this->assertSame( 0.0, SessionSchema::sanitize_rate( -5 ) );
		$this->assertSame( 12.5, SessionSchema::sanitize_rate( 12.5 ) );
	}

	/**
	 * The free-form configuration is only ever stored as an associative array;
	 * anything else is discarded.
	 */
	public function test_sanitize_config_rejects_non_arrays(): void {
		$this->assertSame( array(), SessionSchema::sanitize_config( 'not-an-array' ) );
	}

	/**
	 * String leaves of the configuration are scrubbed and their keys normalized.
	 */
	public function test_sanitize_config_scrubs_string_leaves(): void {
		Functions\when( 'sanitize_key' )->returnArg();
		Functions\when( 'sanitize_text_field' )->alias( static fn( $value ) => trim( (string) $value ) );

		$clean = SessionSchema::sanitize_config(
			array(
				'videoId' => '  abc123  ',
				'plugged' => true,
			)
		);

		$this->assertSame( 'abc123', $clean['videoId'] );
		$this->assertTrue( $clean['plugged'] );
	}

	/**
	 * Finds a field descriptor by its prefixed key.
	 *
	 * @param string $key The prefixed meta key.
	 * @return array<string, mixed> The matching descriptor.
	 */
	private function fieldFor( string $key ): array {
		foreach ( $this->schema()->fields() as $field ) {
			if ( $key === $field['key'] ) {
				return $field;
			}
		}

		$this->fail( "No field descriptor for {$key}." );
	}
}
