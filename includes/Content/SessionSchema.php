<?php
/**
 * Benchmark session data shape.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

use function absint;
use function sanitize_key;
use function sanitize_text_field;

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
 * the run mode and lifecycle status, its battery levels, and the derived drain
 * statistics. Each datum is a single scalar so it can be sorted and filtered as
 * its own column; the free-form run configuration is the lone object field.
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
	 * Every field is registered as a single, REST-exposed meta so the post
	 * type's own REST endpoint surfaces it under `meta` with no bespoke
	 * controller — the listing screen reads it straight from there. Each entry
	 * still needs an `auth_callback`; that is policy the {@see SessionType}
	 * manager owns, so it is intentionally absent here. A default is registered
	 * only when the field declares one — WordPress rejects a default that does
	 * not satisfy the meta's schema.
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

			$metas[ $this->key( $field['key'] ) ] = $args;
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
	 * the session's field names.
	 *
	 * @return array<int, array<string, mixed>> Ordered list of field descriptors.
	 */
	public function fields(): array {
		$fields = array();

		foreach ( $this->definitions() as $field ) {
			$descriptor = array(
				'key'    => $this->key( $field['key'] ),
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
				$columns[] = $this->key( $field['key'] );
			}
		}

		return $columns;
	}

	/**
	 * Prefixes a bare field name into its full, namespaced meta key.
	 *
	 * @param string $field Bare field name (e.g. `status`).
	 * @return string The namespaced meta key (e.g. `bsb_status`).
	 */
	private function key( string $field ): string {
		return $this->meta_prefix . $field;
	}

	/**
	 * Derives a meta field's REST exposure from its definition: a closed schema
	 * for object fields, an enum schema for enumerations, otherwise a bare
	 * `true` so WordPress infers it from the registered type.
	 *
	 * @param array<string, mixed> $field A single field definition.
	 * @return array<string, mixed>|bool The `show_in_rest` value for the field.
	 */
	private function rest_schema( array $field ) {
		if ( 'object' === $field['rest_type'] ) {
			return array(
				'schema' => array(
					'type'                 => 'object',
					'additionalProperties' => true,
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
	 * whether the listing shows it as a default column.
	 *
	 * @return array<int, array<string, mixed>> Ordered list of field definitions.
	 */
	private function definitions(): array {
		return array(
			array(
				'key'            => 'status',
				'rest_type'      => 'string',
				'label'          => 'Status',
				'format'         => 'text',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => 'sanitize_key',
				'elements'       => array(
					'running'  => 'Running',
					'finished' => 'Finished',
					'stopped'  => 'Stopped',
					'aborted'  => 'Aborted',
				),
				'default_column' => true,
			),
			array(
				'key'            => 'mode',
				'rest_type'      => 'string',
				'label'          => 'Mode',
				'format'         => 'text',
				'default'        => self::NO_DEFAULT,
				'sanitize'       => 'sanitize_key',
				'elements'       => array(
					'duration' => 'Duration',
					'target'   => 'Target',
					'baseline' => 'Baseline',
				),
				'default_column' => true,
			),
			array(
				'key'            => 'started_at',
				'rest_type'      => 'string',
				'label'          => 'Started',
				'format'         => 'datetime',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'ended_at',
				'rest_type'      => 'string',
				'label'          => 'Ended',
				'format'         => 'datetime',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'start_level',
				'rest_type'      => 'number',
				'label'          => 'Start level',
				'format'         => 'percent',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_level' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'end_level',
				'rest_type'      => 'number',
				'label'          => 'End level',
				'format'         => 'percent',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_level' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'rate_session',
				'rest_type'      => 'number',
				'label'          => 'Drain rate (%/h)',
				'format'         => 'rate',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_rate' ),
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'rate_window',
				'rest_type'      => 'number',
				'label'          => 'Window rate (%/h)',
				'format'         => 'rate',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_rate' ),
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'projection_min',
				'rest_type'      => 'integer',
				'label'          => 'Projection (min)',
				'format'         => 'minutes',
				'default'        => 0,
				'sanitize'       => 'absint',
				'elements'       => array(),
				'default_column' => true,
			),
			array(
				'key'            => 'baseline_rate',
				'rest_type'      => 'number',
				'label'          => 'Baseline rate (%/h)',
				'format'         => 'rate',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_rate' ),
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'delta_rate',
				'rest_type'      => 'number',
				'label'          => 'Delta rate (%/h)',
				'format'         => 'rate',
				'default'        => 0.0,
				'sanitize'       => array( self::class, 'sanitize_rate' ),
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'pages',
				'rest_type'      => 'integer',
				'label'          => 'Pages',
				'format'         => 'integer',
				'default'        => 0,
				'sanitize'       => 'absint',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'loops',
				'rest_type'      => 'integer',
				'label'          => 'Loops',
				'format'         => 'integer',
				'default'        => 0,
				'sanitize'       => 'absint',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'clicks',
				'rest_type'      => 'integer',
				'label'          => 'Clicks',
				'format'         => 'integer',
				'default'        => 0,
				'sanitize'       => 'absint',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'video_s',
				'rest_type'      => 'integer',
				'label'          => 'Video (s)',
				'format'         => 'integer',
				'default'        => 0,
				'sanitize'       => 'absint',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'ua',
				'rest_type'      => 'string',
				'label'          => 'User agent',
				'format'         => 'text',
				'default'        => '',
				'sanitize'       => 'sanitize_text_field',
				'elements'       => array(),
				'default_column' => false,
			),
			array(
				'key'            => 'config',
				'rest_type'      => 'object',
				'label'          => 'Configuration',
				'format'         => 'object',
				'default'        => array(),
				'sanitize'       => array( self::class, 'sanitize_config' ),
				'elements'       => array(),
				'default_column' => false,
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
	 * Coerces a raw drain-rate meta value to a non-negative number rounded to
	 * four decimals.
	 *
	 * @param mixed $value Raw meta value.
	 * @return float The sanitized drain rate in percent per hour.
	 */
	public static function sanitize_rate( $value ): float {
		return round( max( 0.0, (float) $value ), 4 );
	}

	/**
	 * Sanitizes the free-form run configuration: keeps only an associative
	 * array and scrubs every string leaf, discarding anything else.
	 *
	 * @param mixed $value Raw meta value.
	 * @return array<string, mixed> The sanitized configuration map.
	 */
	public static function sanitize_config( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}

		$clean = array();

		foreach ( $value as $key => $entry ) {
			$name = sanitize_key( (string) $key );

			if ( is_array( $entry ) ) {
				$clean[ $name ] = self::sanitize_config( $entry );
			} elseif ( is_string( $entry ) ) {
				$clean[ $name ] = sanitize_text_field( $entry );
			} elseif ( is_bool( $entry ) ) {
				$clean[ $name ] = $entry;
			} elseif ( is_int( $entry ) ) {
				$clean[ $name ] = absint( $entry );
			} elseif ( is_float( $entry ) ) {
				$clean[ $name ] = (float) $entry;
			}
		}

		return $clean;
	}
}
