<?php
/**
 * Ability annotation sets.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * The annotation sets an ability declares, which tell a client whether it only
 * reads, adds, deletes or resets things. Core also reads them: a read-only
 * ability runs over GET, a destructive and idempotent one over DELETE, and any
 * other over POST.
 */
final class Annotations {

	/**
	 * Annotations of an ability that only reads.
	 *
	 * @return array<string, bool> The annotations.
	 */
	public static function read(): array {
		return array(
			'readonly'    => true,
			'destructive' => false,
			'idempotent'  => true,
		);
	}

	/**
	 * Annotations of an ability that changes something without destroying it.
	 *
	 * @return array<string, bool> The annotations.
	 */
	public static function write(): array {
		return array(
			'readonly'    => false,
			'destructive' => false,
			'idempotent'  => false,
		);
	}

	/**
	 * Annotations of an ability that replaces something with a fixed state, so
	 * running it again changes nothing more.
	 *
	 * @return array<string, bool> The annotations.
	 */
	public static function reset(): array {
		return array(
			'readonly'    => false,
			'destructive' => true,
			'idempotent'  => true,
		);
	}

	/**
	 * Annotations of an ability that destroys something, and whose repeat does
	 * not simply do nothing.
	 *
	 * @return array<string, bool> The annotations.
	 */
	public static function trash(): array {
		return array(
			'readonly'    => false,
			'destructive' => true,
			'idempotent'  => false,
		);
	}
}
