<?php
/**
 * Instantiator test fixture: a zero-argument concrete class.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * A dependency-free class, used to exercise no-constructor building and
 * shared/transient caching in isolation, and as the leaf of a deeper
 * autowired dependency graph.
 */
final class FixtureEngine {
}
