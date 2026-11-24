<?php
/**
 * Benchmark run outcome mapping.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

defined( 'ABSPATH' ) || exit;

/**
 * Maps a stored session's lifecycle status (and its configured mode) back to
 * the cockpit's run-end reason, the key that drives the summary's verdict
 * wording. The session detail screen and the AI agent abilities both read a
 * stored run through this one mapping, so the two never disagree on why a run
 * ended.
 */
final class RunOutcome {

	/**
	 * Maps a stored status and configured mode to the cockpit's run-end reason.
	 *
	 * @param string $status      The stored lifecycle status (`finished`, `stopped`, `aborted` or `failed`).
	 * @param string $config_mode The stored run configuration mode (`duration` or `targetDrop`).
	 * @return string The run-end reason key: `stopped`, `plugged`, `loadError`, `targetDrop` or `duration`.
	 */
	public static function reason( string $status, string $config_mode ): string {
		if ( 'stopped' === $status ) {
			return 'stopped';
		}

		if ( 'aborted' === $status ) {
			return 'plugged';
		}

		if ( 'failed' === $status ) {
			return 'loadError';
		}

		// A finished run completed its mode: a target-drop run hit its mark, a
		// duration run ran its length.
		return 'targetDrop' === $config_mode ? 'targetDrop' : 'duration';
	}
}
