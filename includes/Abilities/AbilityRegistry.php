<?php
/**
 * AI agent abilities manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use ErdemBircan\BatterySurfBench\Support\CapabilityInterface;
use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function wp_register_ability;
use function wp_register_ability_category;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the plugin's abilities with the WordPress Abilities API, from a
 * list of {@see Ability} objects injected at construction.
 *
 * The Abilities API is part of WordPress core: it serves a registered ability
 * over its REST routes, and an ability marked public for MCP is picked up by
 * the MCP Adapter plugin's default server when a site runs it. This plugin
 * depends on neither the adapter nor any AI service: it only registers the
 * abilities.
 *
 * Registration runs inside the two actions core fires lazily for it —
 * `wp_abilities_api_categories_init` and `wp_abilities_api_init` — which are
 * the only places core accepts a category or an ability. An ability's
 * definition is built there too, never at composition time, because it
 * translates strings. Every ability is gated by the plugin's one capability,
 * the same gate as the plugin's own screens, so an agent can do only what its
 * signed-in account can.
 */
class AbilityRegistry implements Manager {

	/**
	 * Stores the category every ability is filed under, the capability that
	 * gates them, and the abilities to register.
	 *
	 * @param string              $category   Slug of the ability category.
	 * @param CapabilityInterface $capability Capability required to run any ability.
	 * @param array<int, Ability> $abilities  The abilities to register.
	 */
	public function __construct(
		private string $category,
		private CapabilityInterface $capability,
		private array $abilities
	) {
	}

	/**
	 * Hooks the category and ability registration into the Abilities API lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}

	/**
	 * Registers the category the abilities are filed under.
	 *
	 * @return void
	 */
	public function register_category(): void {
		wp_register_ability_category(
			$this->category,
			array(
				'label'       => __( 'Battery Surf Bench', 'battery-surf-bench' ),
				'description' => __( 'Battery benchmark runs recorded on this site, and the course of pages the simulated surfer visits during a benchmark.', 'battery-surf-bench' ),
			)
		);
	}

	/**
	 * Builds and registers every injected ability, exposed over REST and public
	 * for the MCP Adapter.
	 *
	 * @return void
	 */
	public function register_abilities(): void {
		foreach ( $this->abilities as $ability ) {
			$definition = $ability->definition();

			wp_register_ability(
				$ability->name(),
				array(
					'label'               => $definition['label'],
					'description'         => $definition['description'],
					'category'            => $this->category,
					'input_schema'        => $definition['input_schema'],
					'output_schema'       => $definition['output_schema'],
					'execute_callback'    => array( $ability, 'execute' ),
					'permission_callback' => array( $this, 'can_run' ),
					'meta'                => array(
						'annotations'  => $definition['annotations'],
						'show_in_rest' => true,
						'mcp'          => array(
							'public' => true,
							'type'   => 'tool',
						),
					),
				)
			);
		}
	}

	/**
	 * Whether the current user may run an ability.
	 *
	 * @return bool Whether the current user is authorized.
	 */
	public function can_run(): bool {
		return $this->capability->allows();
	}
}
