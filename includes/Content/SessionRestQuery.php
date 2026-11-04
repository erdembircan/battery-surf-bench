<?php
/**
 * Server-side query support for the benchmark sessions REST collection.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

use ErdemBircan\BatterySurfBench\Support\Manager;
use WP_REST_Request;

use function add_filter;
use function array_keys;
use function array_map;
use function array_merge;
use function array_unique;
use function array_values;
use function in_array;
use function is_array;
use function is_string;

defined( 'ABSPATH' ) || exit;

/**
 * Teaches the default posts REST controller to sort and filter the
 * `bsbench_session` collection by its meta, so the DataViews listing can page
 * through the whole dataset on the server instead of fetching it all and
 * slicing client-side.
 *
 * The grid sends the view config as query args — `orderby` as a meta key and
 * `bsbench_status` / `bsbench_mode` as filter values. This maps each onto `WP_Query`:
 * meta-key ordering ({@see WP_Query} `meta_value` / `meta_value_num`) and a
 * `meta_query` `IN` clause per active filter. The set of sortable keys, numeric
 * keys and filterable columns is derived from the same {@see SessionSchema}
 * that defines the meta, so the two never drift. There is no free-text search:
 * every column is numeric or enumerated, so filtering is the right tool.
 */
class SessionRestQuery implements Manager {

	/**
	 * Field display formats whose meta holds a number, so ordering by them must
	 * use a numeric (`meta_value_num`) rather than lexical comparison.
	 *
	 * @var string[]
	 */
	private const NUMERIC_FORMATS = array(
		'percent',
		'percentText',
		'percentOptional',
		'rate',
		'runtime',
	);

	/**
	 * Stores the schema the sortable, numeric and filterable columns derive from.
	 *
	 * @param SessionSchema $schema Source of the post type and field descriptors.
	 */
	public function __construct( private SessionSchema $schema ) {
	}

	/**
	 * Hooks the collection-parameter and query filters for the session REST base.
	 *
	 * @return void
	 */
	public function register(): void {
		$post_type = $this->schema->post_type();

		add_filter( "rest_{$post_type}_collection_params", array( $this, 'collection_params' ) );
		add_filter( "rest_{$post_type}_query", array( $this, 'query' ), 10, 2 );
	}

	/**
	 * Widens the collection's accepted parameters: the meta keys become valid
	 * `orderby` values, and each enumerated column gains a filter parameter.
	 *
	 * @param array<string, mixed> $params The controller's collection parameters.
	 * @return array<string, mixed> The widened parameters.
	 */
	public function collection_params( array $params ): array {
		if ( isset( $params['orderby']['enum'] ) && is_array( $params['orderby']['enum'] ) ) {
			$params['orderby']['enum'] = array_values(
				array_unique( array_merge( $params['orderby']['enum'], $this->sortable_keys() ) )
			);
		}

		foreach ( $this->filters() as $key => $values ) {
			$params[ $key ] = array(
				'type'  => 'array',
				'items' => array(
					'type' => 'string',
					'enum' => $values,
				),
			);
		}

		return $params;
	}

	/**
	 * Rewrites the `WP_Query` args for a session collection request: meta-key
	 * ordering and a `meta_query` `IN` clause per active column filter.
	 *
	 * @param array<string, mixed> $args    The query args the controller built.
	 * @param WP_REST_Request      $request The REST request carrying the view config.
	 * @return array<string, mixed> The rewritten query args.
	 */
	public function query( array $args, WP_REST_Request $request ): array {
		$orderby = $request->get_param( 'orderby' );
		if ( is_string( $orderby ) && in_array( $orderby, $this->sortable_keys(), true ) ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- ordering the listing by meta is the feature; no native column holds these values.
			$args['meta_key'] = $orderby;
			$args['orderby']  = in_array( $orderby, $this->numeric_keys(), true )
				? 'meta_value_num'
				: 'meta_value';
		}

		$meta_query = array();

		foreach ( array_keys( $this->filters() ) as $key ) {
			$value = $request->get_param( $key );
			if ( null === $value || array() === $value ) {
				continue;
			}

			$meta_query[] = array(
				'key'     => $key,
				'value'   => (array) $value,
				'compare' => 'IN',
			);
		}

		if ( array() !== $meta_query ) {
			// Active filters AND together to narrow the set.
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- filtering the listing by meta is the feature; no native column holds these values.
			$args['meta_query'] = $meta_query;
		}

		return $args;
	}

	/**
	 * The meta keys the listing may order by — every listed field.
	 *
	 * @return string[] The namespaced meta keys.
	 */
	private function sortable_keys(): array {
		return array_map(
			static fn ( array $field ): string => $field['key'],
			$this->schema->fields()
		);
	}

	/**
	 * The meta keys whose values are numeric, so ordering uses `meta_value_num`.
	 *
	 * @return string[] The namespaced numeric meta keys.
	 */
	private function numeric_keys(): array {
		$keys = array();
		foreach ( $this->schema->fields() as $field ) {
			if ( in_array( $field['format'], self::NUMERIC_FORMATS, true ) ) {
				$keys[] = $field['key'];
			}
		}

		return $keys;
	}

	/**
	 * The filterable (enumerated) columns mapped to their allowed values.
	 *
	 * @return array<string, string[]> Meta key to its allowed values.
	 */
	private function filters(): array {
		$filters = array();
		foreach ( $this->schema->fields() as $field ) {
			if ( isset( $field['elements'] ) && array() !== $field['elements'] ) {
				$filters[ $field['key'] ] = array_map(
					static fn ( array $element ): string => $element['value'],
					$field['elements']
				);
			}
		}

		return $filters;
	}
}
