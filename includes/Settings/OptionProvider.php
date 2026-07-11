<?php
/**
 * Option definition provider contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Describes a single `register_setting()`-backed option: its name and the
 * args WordPress registers it with.
 *
 * {@see OptionRegistry} calls {@see self::definition()} from inside its own
 * `init` callback, never at composition time — a definition's args can
 * legitimately call `__()` (a translatable `description`, for instance), and
 * `__()` must not run before `init` fires. Implementations should build the
 * definition fresh on every call rather than caching it from the constructor,
 * so nothing inside it executes before the registry actually asks for it.
 */
interface OptionProvider {

	/**
	 * Builds this option's `register_setting()` definition.
	 *
	 * @return array{name: string, args: array<string, mixed>} The option name and its `register_setting()` args.
	 */
	public function definition(): array;
}
