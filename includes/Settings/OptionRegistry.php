<?php
/**
 * Plugin options manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Settings;

use ErdemBircan\BatterySurfBench\Support\Manager;

use function add_action;
use function register_setting;

defined( 'ABSPATH' ) || exit;

/**
 * Registers every `register_setting()`-backed option the plugin owns, from a
 * list of definitions injected at construction.
 *
 * This is the plugin's one general options manager: a new option is added by
 * handing this registry another definition — built by whichever domain owns
 * that option's shape and sanitization (e.g.
 * {@see \ErdemBircan\BatterySurfBench\Course\CourseOrderOption} for the
 * surf-course order) — never by writing a new manager dedicated to hooking a
 * single option into WordPress.
 */
class OptionRegistry implements Manager {

	/**
	 * Stores the option definitions this registry registers.
	 *
	 * @param array<int, array{name: string, args: array<string, mixed>}> $definitions Each definition's option name and its `register_setting()` args.
	 */
	public function __construct( private array $definitions ) {
	}

	/**
	 * Hooks the registry's option registration into the WordPress lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_options' ) );
	}

	/**
	 * Registers every injected option definition with WordPress.
	 *
	 * @return void
	 */
	public function register_options(): void {
		foreach ( $this->definitions as $definition ) {
			register_setting( 'bsb_settings', $definition['name'], $definition['args'] );
		}
	}
}
