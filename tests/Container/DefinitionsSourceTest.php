<?php
/**
 * Tests for the compiled-vs-live container definitions source gate.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Container;

use ErdemBircan\BatterySurfBench\Container\DefinitionsSource;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * Behavioral tests for the gate's public contract: a pure boolean decision
 * with no filesystem or WordPress function calls of its own.
 */
final class DefinitionsSourceTest extends TestCase {

	/**
	 * Shared dev-environments list used by most cases below, mirroring the
	 * plugin's real `container.dev_environments` config value.
	 *
	 * @var array<int, string>
	 */
	private const DEV_ENVIRONMENTS = array( 'local', 'development' );

	/**
	 * Outside a dev environment, with a readable compiled artifact, the
	 * compiled definitions are preferred.
	 */
	public function test_prefers_compiled_in_production_when_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertTrue( $gate->prefers_compiled( 'production', self::DEV_ENVIRONMENTS, true ) );
	}

	/**
	 * Outside a dev environment, with no readable compiled artifact, the
	 * live source is used — there is nothing compiled to prefer.
	 */
	public function test_does_not_prefer_compiled_in_production_when_not_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertFalse( $gate->prefers_compiled( 'production', self::DEV_ENVIRONMENTS, false ) );
	}

	/**
	 * A non-listed environment (e.g. staging) is treated like production:
	 * the compiled definitions are preferred when readable.
	 */
	public function test_prefers_compiled_in_staging_when_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertTrue( $gate->prefers_compiled( 'staging', self::DEV_ENVIRONMENTS, true ) );
	}

	/**
	 * In a `development` environment, the live source is always used, even
	 * when a compiled artifact is readable — a stale artifact must never
	 * silently shadow live edits.
	 */
	public function test_does_not_prefer_compiled_in_development_when_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertFalse( $gate->prefers_compiled( 'development', self::DEV_ENVIRONMENTS, true ) );
	}

	/**
	 * In a `local` environment, the live source is always used, even when a
	 * compiled artifact is readable.
	 */
	public function test_does_not_prefer_compiled_in_local_when_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertFalse( $gate->prefers_compiled( 'local', self::DEV_ENVIRONMENTS, true ) );
	}

	/**
	 * In a `development` environment with no readable compiled artifact,
	 * the live source is used — both reasons agree.
	 */
	public function test_does_not_prefer_compiled_in_development_when_not_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertFalse( $gate->prefers_compiled( 'development', self::DEV_ENVIRONMENTS, false ) );
	}

	/**
	 * An empty dev-environments list means no environment is ever treated
	 * as a dev environment, so a readable compiled artifact is preferred
	 * everywhere, including what would otherwise be a dev environment.
	 */
	public function test_prefers_compiled_everywhere_when_dev_environments_is_empty(): void {
		$gate = new DefinitionsSource();

		$this->assertTrue( $gate->prefers_compiled( 'development', array(), true ) );
	}

	// The two cases below pin the fail-safe: the gate is an allowlist of dev
	// environments, not a denylist of production-like ones, so any
	// environment string that is not in the list — including one WordPress
	// would normalize to `production`, or a garbage/misconfigured value —
	// resolves to the compiled/production path, never a surprise live one.

	/**
	 * An unrecognized environment string, with a readable compiled artifact,
	 * fails safe to the compiled definitions — the same outcome as a real
	 * `production` environment.
	 */
	public function test_prefers_compiled_for_an_unrecognized_environment_when_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertTrue( $gate->prefers_compiled( 'staging-typo', self::DEV_ENVIRONMENTS, true ) );
		$this->assertTrue( $gate->prefers_compiled( 'production ', self::DEV_ENVIRONMENTS, true ) );
	}

	/**
	 * An unrecognized environment string with no readable compiled artifact
	 * still falls back to the live source, as always — there is nothing
	 * compiled to fail safe to.
	 */
	public function test_does_not_prefer_compiled_for_an_unrecognized_environment_when_not_readable(): void {
		$gate = new DefinitionsSource();

		$this->assertFalse( $gate->prefers_compiled( 'staging-typo', self::DEV_ENVIRONMENTS, false ) );
		$this->assertFalse( $gate->prefers_compiled( 'production ', self::DEV_ENVIRONMENTS, false ) );
	}
}
