<?php
/**
 * The find-pages ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function get_posts;

defined( 'ABSPATH' ) || exit;

/**
 * Searches the site's posts and pages for ones to add to the course, and says
 * for each whether it can be added.
 */
class FindPages implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/find-pages';

	/**
	 * Stores the collaborator that knows the course and the post types the search covers.
	 *
	 * @param CourseEditor       $editor     Reads the course and checks which posts can join it.
	 * @param array<int, string> $post_types Post types the search covers.
	 */
	public function __construct(
		private CourseEditor $editor,
		private array $post_types
	) {
	}

	/**
	 * The ability's registered name.
	 *
	 * @return string The ability name.
	 */
	public function name(): string {
		return self::NAME;
	}

	/**
	 * Builds the ability's definition.
	 *
	 * @return array{label: string, description: string, input_schema: array<string, mixed>, output_schema: array<string, mixed>, annotations: array<string, bool>} The ability definition.
	 */
	public function definition(): array {
		return array(
			'label'         => __( 'Find pages for the course', 'battery-surf-bench' ),
			'description'   => __( "Searches the site's posts and pages by title, to add one to the course. Each result says whether it can be added and, if not, why: only published, public posts and pages can be in the course. Leave out the search to list the most recent ones.", 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'properties'           => array(
					'search' => array(
						'type'        => 'string',
						'description' => __( 'Text to look for in post and page titles.', 'battery-surf-bench' ),
					),
					'limit'  => array(
						'type'        => 'integer',
						'minimum'     => 1,
						'maximum'     => 50,
						'default'     => 20,
						'description' => __( 'How many results to return, from 1 to 50.', 'battery-surf-bench' ),
					),
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'pages' => array(
						'type'  => 'array',
						'items' => array(
							'type'       => 'object',
							'properties' => array(
								'post_id'   => array( 'type' => 'integer' ),
								'title'     => array( 'type' => 'string' ),
								'post_type' => array( 'type' => 'string' ),
								'status'    => array( 'type' => 'string' ),
								'url'       => array( 'type' => array( 'string', 'null' ) ),
								'can_add'   => array( 'type' => 'boolean' ),
								'in_course' => array( 'type' => 'boolean' ),
								'reason'    => array( 'type' => array( 'string', 'null' ) ),
							),
						),
					),
				),
			),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Searches the site's posts and pages.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The matching posts, each with whether it can join the course.
	 */
	public function execute( array $input ): array|WP_Error {
		$search = isset( $input['search'] ) ? (string) $input['search'] : '';
		$query  = array(
			'post_type'      => $this->post_types,
			'post_status'    => array( 'publish', 'draft', 'pending', 'private', 'future' ),
			'posts_per_page' => (int) ( $input['limit'] ?? 20 ),
			'orderby'        => '' === $search ? 'date' : 'relevance',
			'order'          => 'DESC',
		);

		if ( '' !== $search ) {
			$query['s'] = $search;
		}

		$entries = $this->editor->entries();
		$pages   = array();

		foreach ( get_posts( $query ) as $post ) {
			$entry       = array(
				'kind' => 'user',
				'id'   => $post->ID,
			);
			$described   = $this->editor->describe_entry( $entry, 0 );
			$position    = $this->editor->position_of_entry( $entries, $entry );
			$eligibility = $this->editor->eligibility( $post->ID );
			$reason      = null;

			if ( $eligibility instanceof WP_Error ) {
				$reason = $eligibility->get_error_message();
			} elseif ( null !== $position ) {
				$reason = $this->editor->already_in_course( $entry, $position )->get_error_message();
			}

			$pages[] = array(
				'post_id'   => $post->ID,
				'title'     => $described['title'],
				'post_type' => $post->post_type,
				'status'    => $post->post_status,
				'url'       => 'publish' === $post->post_status ? $described['url'] : null,
				'can_add'   => true === $eligibility && null === $position,
				'in_course' => null !== $position,
				'reason'    => $reason,
			);
		}

		return array( 'pages' => $pages );
	}
}
