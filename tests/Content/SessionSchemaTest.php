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

	private const POST_TYPE = 'bsbench_session';
	private const PREFIX    = 'bsbench_';

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
			array( 'running', 'finished', 'stopped', 'aborted', 'failed' ),
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
	 * The labels the listing shows — the column headers and the enumerated value
	 * labels — pass through translation, so the grid localizes for the viewer
	 * rather than always reading English. The descriptors carry already-translated
	 * strings (the screen localizes them to DataViews as plain data), so a label
	 * run through `__()` is the only translation seam.
	 */
	public function test_field_and_element_labels_are_translated(): void {
		Functions\when( '__' )->alias(
			static fn( string $text ): string => "xx_{$text}"
		);

		$status = $this->fieldFor( self::PREFIX . 'status' );

		$this->assertSame( 'xx_Status', $status['label'] );
		$this->assertContains(
			array(
				'value' => 'running',
				'label' => 'xx_Running',
			),
			$status['elements']
		);
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
	 * The run configuration is registered as meta under the `config` group, so a
	 * finished run's settings ride the same REST record without colliding with the
	 * identity scalars (e.g. the run's `mode` and the configured `config_mode`).
	 */
	public function test_configuration_is_registered_under_the_config_group(): void {
		$metas = $this->schema()->metas();

		foreach ( array( 'config_mode', 'config_duration', 'config_target_percent' ) as $field ) {
			$this->assertArrayHasKey( self::PREFIX . $field, $metas );
		}
	}

	/**
	 * Surf speed drives playback, not the drain calculations, so it is no part of
	 * the stored session record — no configuration meta persists it.
	 */
	public function test_speed_is_not_persisted(): void {
		$this->assertArrayNotHasKey( self::PREFIX . 'config_speed', $this->schema()->metas() );
	}

	/**
	 * The derived end-of-run statistics are registered as meta so the figures
	 * survive without recomputation.
	 */
	public function test_derived_statistics_are_registered_meta(): void {
		$metas = $this->schema()->metas();

		foreach ( array( 'dropped_pct', 'elapsed', 'rate_10', 'rate_session', 'time_to_empty' ) as $field ) {
			$this->assertArrayHasKey( self::PREFIX . $field, $metas );
		}
	}

	/**
	 * The sample log is registered as an array meta with an element schema, which
	 * is what lets the native REST endpoint accept and validate the bulk log
	 * without a bespoke controller.
	 */
	public function test_samples_register_as_an_array_meta_with_an_item_schema(): void {
		$samples = $this->schema()->metas()[ self::PREFIX . 'samples' ];

		$this->assertSame( 'array', $samples['type'] );
		$this->assertSame( 'array', $samples['show_in_rest']['schema']['type'] );
		$this->assertSame( 'object', $samples['show_in_rest']['schema']['items']['type'] );
		$this->assertArrayHasKey( 'level', $samples['show_in_rest']['schema']['items']['properties'] );
	}

	/**
	 * The redundant configuration scalars and the bulky sample log are persisted
	 * but kept off the listing, so the grid is not cluttered by them.
	 */
	public function test_persisted_only_fields_are_not_listed(): void {
		$listed = array_column( $this->schema()->fields(), 'key' );

		foreach ( array( 'config_mode', 'samples' ) as $field ) {
			$this->assertNotContains( self::PREFIX . $field, $listed );
		}
	}

	/**
	 * The run length and target and the derived statistics are listed as columns,
	 * so the grid surfaces the configuration and results a run produced.
	 */
	public function test_configuration_and_statistics_are_listed(): void {
		$listed = array_column( $this->schema()->fields(), 'key' );

		foreach ( array( 'config_duration', 'config_target_percent', 'dropped_pct', 'elapsed', 'rate_10', 'rate_session', 'time_to_empty' ) as $field ) {
			$this->assertContains( self::PREFIX . $field, $listed );
		}
	}

	/**
	 * The configured mode constrains its REST values to the cockpit's run modes,
	 * preserving the uppercase letter in `targetDrop` that `sanitize_key` would
	 * have stripped.
	 */
	public function test_config_mode_constrains_its_rest_values(): void {
		$mode = $this->schema()->metas()[ self::PREFIX . 'config_mode' ];

		$this->assertSame(
			array( 'duration', 'targetDrop' ),
			$mode['show_in_rest']['schema']['enum']
		);
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
	 * Percentages are clamped to a whole 0..100, guarding the configured target
	 * battery against out-of-range writes.
	 */
	public function test_sanitize_percent_clamps_to_whole_0_100(): void {
		$this->assertSame( 100, SessionSchema::sanitize_percent( 140 ) );
		$this->assertSame( 0, SessionSchema::sanitize_percent( -5 ) );
		$this->assertSame( 45, SessionSchema::sanitize_percent( 45.4 ) );
	}

	/**
	 * The drop is clamped to the 0..100 points a run can fall, rounded to two
	 * decimals.
	 */
	public function test_sanitize_drop_clamps_and_rounds(): void {
		$this->assertSame( 100.0, SessionSchema::sanitize_drop( 150 ) );
		$this->assertSame( 0.0, SessionSchema::sanitize_drop( -1 ) );
		$this->assertSame( 12.35, SessionSchema::sanitize_drop( 12.3456 ) );
	}

	/**
	 * Drain rates are clamped non-negative and rounded to a tenth; an
	 * unmeasurable rate stores zero.
	 */
	public function test_sanitize_rate_clamps_and_rounds(): void {
		$this->assertSame( 18.5, SessionSchema::sanitize_rate( 18.46 ) );
		$this->assertSame( 0.0, SessionSchema::sanitize_rate( -3 ) );
		$this->assertSame( 0.0, SessionSchema::sanitize_rate( null ) );
	}

	/**
	 * The projected runtime is a non-negative whole number of seconds; an
	 * unprojectable runtime stores zero.
	 */
	public function test_sanitize_seconds_clamps_to_non_negative_whole(): void {
		$this->assertSame( 7200, SessionSchema::sanitize_seconds( 7200.4 ) );
		$this->assertSame( 0, SessionSchema::sanitize_seconds( -10 ) );
		$this->assertSame( 0, SessionSchema::sanitize_seconds( null ) );
	}

	/**
	 * The elapsed run length is a non-negative whole number of seconds, unbounded
	 * above since a run can be cut short or run long at any moment.
	 */
	public function test_sanitize_elapsed_clamps_to_non_negative_whole(): void {
		$this->assertSame( 27, SessionSchema::sanitize_elapsed( 26.6 ) );
		$this->assertSame( 0, SessionSchema::sanitize_elapsed( -4 ) );
		$this->assertSame( 1500, SessionSchema::sanitize_elapsed( 1500 ) );
	}

	/**
	 * The configured run length is clamped to the supported 300..14400 second
	 * range (5 to 240 minutes) and stored in whole seconds.
	 */
	public function test_sanitize_duration_clamps_to_second_range(): void {
		$this->assertSame( 1800, SessionSchema::sanitize_duration( 1800 ) );
		$this->assertSame( 300, SessionSchema::sanitize_duration( 60 ) );
		$this->assertSame( 14400, SessionSchema::sanitize_duration( 99999 ) );
	}

	/**
	 * The sample log drops malformed entries and clamps each surviving plateau,
	 * so a tampered or partial log cannot poison the stored record.
	 */
	public function test_sanitize_samples_drops_malformed_and_clamps(): void {
		$clean = SessionSchema::sanitize_samples(
			array(
				array(
					't'        => -50,
					'level'    => 2,
					'charging' => 1,
					'count'    => 0,
				),
				'not-an-array',
				array( 'level' => 0.5 ),
			)
		);

		$this->assertCount( 1, $clean );
		$this->assertSame( 0.0, $clean[0]['t'] );
		$this->assertSame( 1.0, $clean[0]['level'] );
		$this->assertTrue( $clean[0]['charging'] );
		$this->assertSame( 1, $clean[0]['count'] );
	}

	/**
	 * A non-array sample log sanitizes to an empty log rather than erroring.
	 */
	public function test_sanitize_samples_rejects_a_non_array(): void {
		$this->assertSame( array(), SessionSchema::sanitize_samples( 'nonsense' ) );
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
