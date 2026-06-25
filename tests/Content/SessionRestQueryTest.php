<?php
/**
 * Tests for the benchmark sessions REST query manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use ErdemBircan\BatterySurfBench\Content\SessionRestQuery;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_filter;

/**
 * Behavioral tests for the server-side query layer: the collection parameters
 * it widens (meta ordering + per-column filters) and how it rewrites the
 * `WP_Query` args for ordering, filtering and searching by meta.
 */
final class SessionRestQueryTest extends TestCase {

	/**
	 * Builds the manager over the real schema, so the sortable, numeric and
	 * filterable columns are the genuine session ones.
	 *
	 * @return SessionRestQuery The manager under test.
	 */
	private function manager(): SessionRestQuery {
		return new SessionRestQuery( new SessionSchema( 'bsb_session', 'bsb_' ) );
	}

	/**
	 * Builds a REST request stub whose `get_param` reads from the given map.
	 *
	 * @param array<string, mixed> $params The parameter values to serve.
	 * @return \WP_REST_Request The request double.
	 */
	private function request( array $params ) {
		$request = Mockery::mock( 'WP_REST_Request' );
		$request->shouldReceive( 'get_param' )->andReturnUsing(
			static fn ( string $key ) => $params[ $key ] ?? null
		);

		return $request;
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->manager() );
	}

	/**
	 * Registering hooks the collection-params and query filters for the session
	 * REST base.
	 */
	public function test_register_hooks_collection_and_query_filters(): void {
		$manager = $this->manager();
		$manager->register();

		$this->assertNotFalse(
			has_filter( 'rest_bsb_session_collection_params', array( $manager, 'collection_params' ) )
		);
		$this->assertNotFalse(
			has_filter( 'rest_bsb_session_query', array( $manager, 'query' ) )
		);
	}

	/**
	 * The meta keys become valid order-by values and each enumerated column gains
	 * a filter parameter.
	 */
	public function test_collection_params_adds_meta_orderby_and_filter_params(): void {
		$params = array( 'orderby' => array( 'enum' => array( 'date', 'id', 'title' ) ) );

		$out = $this->manager()->collection_params( $params );

		$this->assertContains( 'bsb_started_at', $out['orderby']['enum'] );
		$this->assertContains( 'bsb_elapsed', $out['orderby']['enum'] );
		$this->assertContains( 'date', $out['orderby']['enum'] ); // keeps the originals.
		$this->assertArrayHasKey( 'bsb_status', $out );
		$this->assertArrayHasKey( 'bsb_mode', $out );
		$this->assertSame( 'array', $out['bsb_status']['type'] );
	}

	/**
	 * Ordering by a numeric column uses a numeric meta comparison; a string
	 * column uses a lexical one.
	 */
	public function test_query_orders_by_meta_choosing_numeric_or_lexical(): void {
		$numeric = $this->manager()->query( array(), $this->request( array( 'orderby' => 'bsb_elapsed' ) ) );
		$this->assertSame( 'bsb_elapsed', $numeric['meta_key'] );
		$this->assertSame( 'meta_value_num', $numeric['orderby'] );

		$string = $this->manager()->query( array(), $this->request( array( 'orderby' => 'bsb_status' ) ) );
		$this->assertSame( 'bsb_status', $string['meta_key'] );
		$this->assertSame( 'meta_value', $string['orderby'] );
	}

	/**
	 * An unknown order-by (a native column) is left untouched.
	 */
	public function test_query_leaves_native_orderby_untouched(): void {
		$out = $this->manager()->query( array(), $this->request( array( 'orderby' => 'date' ) ) );

		$this->assertArrayNotHasKey( 'meta_key', $out );
	}

	/**
	 * An active column filter becomes a meta_query `IN` clause over its values.
	 */
	public function test_query_maps_a_filter_to_a_meta_query_in_clause(): void {
		$out = $this->manager()->query(
			array(),
			$this->request( array( 'bsb_status' => array( 'running', 'finished' ) ) )
		);

		$this->assertContains(
			array(
				'key'     => 'bsb_status',
				'value'   => array( 'running', 'finished' ),
				'compare' => 'IN',
			),
			$out['meta_query']
		);
	}
}
