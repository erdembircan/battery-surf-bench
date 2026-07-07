<?php
/**
 * Benchmark session data shape.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

defined( 'ABSPATH' ) || exit;

/**
 * The single source of truth for a benchmark session's stored data.
 *
 * One declarative table of field definitions drives everything downstream: the
 * post-meta registration handed to WordPress and the field descriptors handed
 * to the DataViews admin screen. Defining the shape once — rather than wiring
 * each field by hand on both sides — keeps the meta layer and the listing UI
 * from drifting apart, and means a new datum is added in exactly one place.
 *
 * The shape mirrors the session record the cockpit produces while benchmarking:
 * the run mode and lifecycle status, its battery levels, the browser the run
 * was captured on, the derived drain statistics, the configuration the run used,
 * and the run-length-encoded sample log. The identity and result scalars, the
 * run length / target, and the derived statistics are listed as columns; the
 * remaining configuration (the `config_mode`, redundant with the listed mode)
 * and the bulky sample log are registered as meta but kept
 * off the listing (`listed => false`) — they ride the same REST record without
 * cluttering the grid.
 */
class SessionSchema {

	/**
	 * Marks a field that registers no default value. WordPress validates a
	 * registered default against the meta's schema, so an enumerated field with
	 * no valid neutral value (it is always set when a session is created) opts
	 * out rather than registering an out-of-range default.
	 *
	 * @var string
	 */
	private const NO_DEFAULT = "\0no-default";

	/**
	 * Group segment that namespaces the run-configuration meta under the prefix,
	 * yielding keys like `bsb_config_mode`. The configuration the cockpit ran with
	 * is stored apart from the session's identity and result scalars so the two
	 * concerns stay legible in the meta table and over REST.
	 *
	 * @var string
	 */
	private const CONFIG_GROUP = 'config';

	/**
	 * Stores the post type and the prefix every meta key is namespaced with.
	 *
	 * @param string $post_type   Post type the sessions are stored as.
	 * @param string $meta_prefix Prefix applied to every registered meta key.
	 */
	public function __construct(
		private string $post_type,
		private string $meta_prefix
	) {
	}

	/**
	 * Returns the post type benchmark sessions are stored as.
	 *
	 * @return string The post type slug.
	 */
	public function post_type(): string {
		return $this->post_type;
	}

	/**
	 * Builds the post-meta registration arguments keyed by full meta key.
	 *
	 * Every field — listed or not — is registered as a single, REST-exposed meta
	 * so the post type's own REST endpoint surfaces it under `meta` with no
	 * bespoke controller: the listing screen reads the scalars straight from
	 * there, and the cockpit writes the whole record back through the same
	 * endpoint. Each entry still needs an `auth_callback`; that is policy the
	 * {@see SessionType} manager owns, so it is intentionally absent here. A
	 * default is registered only when the field declares one — WordPress rejects
	 * a default that does not satisfy the meta's schema.
	 *
	 * @return array<string, array<string, mixed>> Meta key mapped to its registration args.
	 */
	public function metas(): array {
		$metas = array();

		foreach ( $this->definitions() as $field ) {
			$args = array(
				'type'              => $field['rest_type'],
				'single'            => true,
				'sanitize_callback' => $field['sanitize'],
				'show_in_rest'      => $this->rest_schema( $field ),
			);

			if ( self::NO_DEFAULT !== $field['default'] ) {
				$args['default'] = $field['default'];
			}

			$metas[ $this->key( $field['key'], $field['group'] ?? '' ) ] = $args;
		}

		return $metas;
	}

	/**
	 * Builds the field descriptors the DataViews admin screen is localized with.
	 *
	 * Each descriptor carries the prefixed meta key the REST record exposes, a
	 * human label, a display format the front end maps to a renderer, and the
	 * selectable elements for the fields that are enumerations. The screen turns
	 * these into DataViews fields generically, so the listing never hard-codes
	 * the session's field names. Only fields marked for the listing are described
	 * here; configuration, derived statistics and the sample log are persisted as
	 * meta but never surface as columns.
	 *
	 * @return array<int, array<string, mixed>> Ordered list of field descriptors.
	 */
	public function fields(): array {
		$fields = array();

		foreach ( $this->definitions() as $field ) {
			if ( false === ( $field['listed'] ?? true ) ) {
				continue;
			}

			$descriptor = array(
				'key'    => $this->key( $field['key'], $field['group'] ?? '' ),
				'label'  => $field['label'],
				'format' => $field['format'],
			);

			if ( array() !== $field['elements'] ) {
				$descriptor['elements'] = $this->elements( $field['elements'] );
			}

			$fields[] = $descriptor;
		}

		return $fields;
	}

	/**
	 * Returns the keys, prefixed and in definition order, of the fields shown as
	 * the listing's default columns.
	 *
	 * @return array<int, string> Default visible column keys.
	 */
	public function default_columns(): array {
		$columns = array();

		foreach ( $this->definitions() as $field ) {
			if ( true === $field['default_column'] ) {
				$columns[] = $this->key( $field['key'], $field['group'] ?? '' );
			}
		}

		return $columns;
	}

	/**
	 * Prefixes a bare field name into its full, namespaced meta key, inserting an
	 * optional group segment so a configuration field becomes, for example,
	 * `bsb_config_mode` rather than `bsb_mode`.
	 *
	 * @param string $field Bare field name (e.g. `status`).
	 * @param string $group Optional group segment (e.g. `config`); empty for none.
	 * @return string The namespaced meta key (e.g. `bsb_status`).
	 */
	private function key( string $field, string $group = '' ): string {
		$segment = '' !== $group ? $group . '_' : '';

		return $this->meta_prefix . $segment . $field;
	}

	/**
	 * Derives a meta field's REST exposure from its definition. An array field
	 * declares its element schema (WordPress requires a schema for array meta);
	 * an enumeration constrains its values; otherwise a bare `true` lets
	 * WordPress infer the schema from the registered type.
	 *
	 * @param array<string, mixed> $field A single field definition.
	 * @return array<string, mixed>|bool The `show_in_rest` value for the field.
	 */
	private function rest_schema( array $field ) {
		if ( isset( $field['items'] ) ) {
			return array(
				'schema' => array(
					'type'  => 'array',
					'items' => $field['items'],
				),
			);
		}

		if ( array() !== $field['elements'] ) {
			return array(
				'schema' => array(
					'type' => $field['rest_type'],
					'enum' => array_keys( $field['elements'] ),
				),
			);
		}

		return true;
	}

	/**
	 * Reshapes an associative value-to-label map into the value/label object
	 * list DataViews expects for an enumerated field.
	 *
	 * @param array<string, string> $elements Value-to-label map.
	 * @return array<int, array<string, string>> List of value/label objects.
	 */
	private function elements( array $elements ): array {
		$list = array();

		foreach ( $elements as $value => $label ) {
			$list[] = array(
				'value' => (string) $value,
				'label' => $label,
			);
		}

		return $list;
	}

	/**
	 * The declarative session field table both the meta layer and the listing
	 * derive from. Each row pairs a bare field name with the storage type, the
	 * sanitizer guarding writes, the display format, any enumerated values, and
	 * whether the listing shows it as a default column. Rows may also carry a
	 * `group` segment (namespacing the key), a `listed` flag (false keeps a field
	 * off the listing while still registering it as meta), and an `items` schema
	 * (for an array field).
	 *
	 * @return array<int, array<string, mixed>> Ordered list of field definitions.
	 */
	private function definitions(): array {
		return array(
			array(
				'key'            => 'status',
				'rest_type'      => 'string',
				'label'          => __( 'Status', 'battery-surf-bench' ),
				'format'         => 'status',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => 'sanitize_key',
				'elements'       => array(
					'running'  => __( 'Running', 'battery-surf-bench' ),
					'finished' => __( 'Finished', 'battery-surf-bench' ),
					'stopped'  => __( 'Stopped', 'battery-surf-bench' ),
					'aborted'  => __( 'Aborted', 'battery-surf-bench' ),
					'failed'   => __( 'Load failed', 'battery-surf-bench' ),
				),
				'default_column' => true,
			),
			array(
				'key'            => 'mode',
				'rest_type'      => 'string',
				'label'          => __( 'Mode', 'battery-surf-bench' ),
				'format'         => 'text',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => 'sanitize_key',
				'elements'       => array(
					'duration' => __( 'Duration', 'battery-surf-bench' ),
					'target'   => __( 'Target', 'battery-surf-bench' ),
				),
				'default_column' => true,
			),
			array(
				'key'            => 'started_at',
				'rest_type'      => 'string',
				'label'          => __( 'Started', 'battery-surf-bench' ),
				'format'         => 'datetime',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'ended_at',
				'rest_type'      => 'string',
				'label'          => __( 'Ended', 'battery-surf-bench' ),
				'format'         => 'datetime',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'start_level',
				'rest_type'      => 'number',
				'label'          => __( 'Start level', 'battery-surf-bench' ),
				'format'         => 'percent',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_level' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'end_level',
				'rest_type'      => 'number',
				'label'          => __( 'End level', 'battery-surf-bench' ),
				'format'         => 'percent',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_level' ),
				'elements'       => array(),
				'default_column' => true,
			),
			// The browser the run was captured on, kept as discrete fields — name,
			// major version and OS — rather than a pre-formatted string, so the
			// listing decides how they read. Only the name surfaces as a column,
			// with a `browser` renderer that composes the three for display; the
			// version and OS are stored and REST-exposed but not listed in their
			// own right.
			array(
				'key'            => 'ua_browser',
				'rest_type'      => 'string',
				'label'          => __( 'Browser', 'battery-surf-bench' ),
				'format'         => 'browser',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'ua_version',
				'rest_type'      => 'string',
				'label'          => __( 'Browser version', 'battery-surf-bench' ),
				'format'         => 'text',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'listed'         => false,
				'default_column' => false,
			),
			array(
				'key'            => 'ua_os',
				'rest_type'      => 'string',
				'label'          => __( 'Operating system', 'battery-surf-bench' ),
				'format'         => 'text',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'listed'         => false,
				'default_column' => false,
			),
			// Derived end-of-run statistics. Persisted alongside the raw inputs so
			// the figures survive without recomputation. A run too short to compute
			// a rate or projection stores zero: WordPress REST single meta cannot
			// hold a null (a null write deletes the meta, and an absent numeric
			// meta reads back as its type's empty value, not null), and zero is no
			// valid reading for these quantities — a 0 %/h drain or 0s-to-empty —
			// so it serves as the unmeasurable marker without fighting the meta API.
			array(
				'key'            => 'elapsed',
				'rest_type'      => 'integer',
				'label'          => __( 'Elapsed', 'battery-surf-bench' ),
				'format'         => 'runtime',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_elapsed' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'dropped_pct',
				'rest_type'      => 'number',
				'label'          => __( 'Dropped', 'battery-surf-bench' ),
				'format'         => 'percentText',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_drop' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'rate_10',
				'rest_type'      => 'number',
				'label'          => __( 'Rate · 10 min', 'battery-surf-bench' ),
				'format'         => 'rate',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_rate' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'rate_session',
				'rest_type'      => 'number',
				'label'          => __( 'Rate · session', 'battery-surf-bench' ),
				'format'         => 'rate',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_rate' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'time_to_empty',
				'rest_type'      => 'integer',
				'label'          => __( '100% → 0%', 'battery-surf-bench' ),
				'format'         => 'runtime',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_seconds' ),
				'elements'       => array(),
				'default_column' => true,
			),
			// Run configuration, namespaced under `config`. Surf speed is
			// deliberately absent: it drives playback, not the drain calculations,
			// so it is no part of the stored session record.
			array(
				'key'            => 'mode',
				'group'          => self::CONFIG_GROUP,
				'rest_type'      => 'string',
				'label'          => __( 'Config mode', 'battery-surf-bench' ),
				'format'         => 'text',
				'default'        => self::NO_DEFAULT,
				// Not `sanitize_key`: the cockpit's `targetDrop` mode carries an
				// uppercase letter that `sanitize_key` would strip, breaking the
				// enum match. `sanitize_text_field` preserves it; the enum schema
				// still rejects any value outside the allowed set over REST.
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(
					'duration'   => __( 'Duration', 'battery-surf-bench' ),
					'targetDrop' => __( 'Target drop', 'battery-surf-bench' ),
				),
				'default_column' => false,
				'listed'         => false,
			),
			array(
				'key'            => 'duration',
				'group'          => self::CONFIG_GROUP,
				'rest_type'      => 'integer',
				'label'          => __( 'Duration', 'battery-surf-bench' ),
				'format'         => 'runtime',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_duration' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'target_percent',
				'group'          => self::CONFIG_GROUP,
				'rest_type'      => 'integer',
				'label'          => __( 'Target', 'battery-surf-bench' ),
				'format'         => 'percentOptional',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_percent' ),
				'elements'       => array(),
				'default_column' => true,
			),
			// The run-length-encoded sample log: one plateau record per battery
			// level/charging step. Stored whole as an array meta — WordPress
			// requires the element schema declared below — rather than a separate
			// table, since nothing reads it mid-run; it is written once at run end.
			array(
				'key'            => 'samples',
				'rest_type'      => 'array',
				'label'          => __( 'Samples', 'battery-surf-bench' ),
				'format'         => 'text',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => array( self::class, 'sanitize_samples' ),
				'elements'       => array(),
				'default_column' => false,
				'listed'         => false,
				'items'          => array(
					'type'       => 'object',
					'properties' => array(
						't'        => array( 'type' => 'number' ),
						'level'    => array( 'type' => 'number' ),
						'charging' => array( 'type' => 'boolean' ),
						'count'    => array( 'type' => 'integer' ),
					),
				),
			),
		);
	}

	/**
	 * Clamps a raw battery level to the 0..1 fraction the cockpit reports,
	 * rounded to four decimals.
	 *
	 * @param mixed $value Raw meta value.
	 * @return float The clamped battery level.
	 */
	public static function sanitize_level( $value ): float {
		$level = max( 0.0, min( 1.0, (float) $value ) );

		return round( $level, 4 );
	}

	/**
	 * Clamps a raw value to a whole percentage in the 0..100 range, guarding the
	 * configured target battery against out-of-range writes.
	 *
	 * @param mixed $value Raw meta value.
	 * @return int The clamped percentage.
	 */
	public static function sanitize_percent( $value ): int {
		return (int) max( 0, min( 100, (int) round( (float) $value ) ) );
	}

	/**
	 * Clamps a raw drop to the 0..100 percentage points a run can fall, rounded
	 * to two decimals.
	 *
	 * @param mixed $value Raw meta value.
	 * @return float The clamped drop in percentage points.
	 */
	public static function sanitize_drop( $value ): float {
		return round( max( 0.0, min( 100.0, (float) $value ) ), 2 );
	}

	/**
	 * Clamps a raw drain rate to a non-negative figure (a draining battery never
	 * rises mid-run), rounded to a tenth of a percent per hour. A run that could
	 * not compute the rate stores zero (see the derived-statistics note above).
	 *
	 * @param mixed $value Raw meta value.
	 * @return float The clamped rate.
	 */
	public static function sanitize_rate( $value ): float {
		return round( max( 0.0, (float) $value ), 1 );
	}

	/**
	 * Clamps a raw projected time-to-empty to a non-negative whole number of
	 * seconds. A run that could not project it stores zero (see the
	 * derived-statistics note above).
	 *
	 * @param mixed $value Raw meta value.
	 * @return int The clamped seconds.
	 */
	public static function sanitize_seconds( $value ): int {
		return (int) max( 0, (int) round( (float) $value ) );
	}

	/**
	 * Clamps a raw elapsed run length to a non-negative whole number of seconds —
	 * how long the run actually lasted, unbounded above (unlike the configured
	 * duration), since a run can be cut short or run long at any moment.
	 *
	 * @param mixed $value Raw meta value.
	 * @return int The clamped elapsed seconds.
	 */
	public static function sanitize_elapsed( $value ): int {
		return (int) max( 0, (int) round( (float) $value ) );
	}

	/**
	 * Clamps a raw configured run length to the supported 300..14400 second range
	 * (5 to 240 minutes), stored in seconds as the base time unit. Whole seconds;
	 * not snapped to the stepper's minute granularity, so finer future steps store
	 * losslessly.
	 *
	 * @param mixed $value Raw meta value.
	 * @return int The clamped run length in seconds.
	 */
	public static function sanitize_duration( $value ): int {
		return (int) max( 300, min( 14400, (int) round( (float) $value ) ) );
	}

	/**
	 * Validates the run-length-encoded sample log, dropping any malformed entry
	 * and clamping each surviving plateau to its sane range: a non-negative
	 * elapsed time, a 0..1 battery level, a boolean charging flag, and a positive
	 * collapsed-reading count.
	 *
	 * @param mixed $value Raw meta value.
	 * @return array<int, array<string, float|bool|int>> The cleaned sample log.
	 */
	public static function sanitize_samples( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}

		$clean = array();

		foreach ( $value as $sample ) {
			if ( ! is_array( $sample ) ) {
				continue;
			}

			if ( ! isset( $sample['t'], $sample['level'], $sample['charging'], $sample['count'] ) ) {
				continue;
			}

			$clean[] = array(
				't'        => max( 0.0, (float) $sample['t'] ),
				'level'    => self::sanitize_level( $sample['level'] ),
				'charging' => (bool) $sample['charging'],
				'count'    => (int) max( 1, (int) $sample['count'] ),
			);
		}

		return $clean;
	}
}
