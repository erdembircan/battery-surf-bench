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
 * list of {@see OptionProvider}s injected at construction.
 *
 * This is the plugin's one general options manager: a new option is added by
 * handing this registry another provider — built by whichever domain owns
 * that option's shape and sanitization (e.g.
 * {@see \ErdemBircan\BatterySurfBench\Course\CourseOrderOption} for the
 * surf-course order) — never by writing a new manager dedicated to hooking a
 * single option into WordPress.
 *
 * A provider (not a pre-built definition array) is what's injected on
 * purpose: `register_options()` — the `init` callback — is what calls each
 * provider's `definition()`, so a definition is only ever built once `init`
 * has fired. A definition's args can legitimately call `__()` (a
 * translatable `description`, for instance), and WordPress requires that no
 * plugin translation function run before `init`; building definitions eagerly
 * at composition time (well before `init`) would violate that.
 */
class OptionRegistry implements Manager {

	/**
	 * Stores the option providers this registry registers.
	 *
	 * @param array<int, OptionProvider> $providers Providers of the options to register.
	 */
	public function __construct( private array $providers ) {
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
	 * Builds and registers every injected provider's option definition with
	 * WordPress.
	 *
	 * @return void
	 */
	public function register_options(): void {
		foreach ( $this->providers as $provider ) {
			$definition = $provider->definition();

			register_setting( 'bsb_settings', $definition['name'], $definition['args'] );
		}
	}
}
