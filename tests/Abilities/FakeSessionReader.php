<?php
/**
 * In-memory session reader for the ability tests.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\SessionReader;

/**
 * A session reader holding normalized runs in memory, recorded and trashed,
 * so the abilities are tested through what they read instead of through mocked
 * calls.
 */
final class FakeSessionReader extends SessionReader {

	/**
	 * Recorded runs, by id.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	private array $runs;

	/**
	 * Trashed runs, by id.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	private array $trashed;

	/**
	 * Stores the runs the double serves.
	 *
	 * @param array<int, array<string, mixed>>             $runs     The recorded runs.
	 * @param array<int, array<string, mixed>>             $trashed  The trashed runs.
	 * @param array<int, array<int, array<string, mixed>>> $readings Readings by run id.
	 */
	public function __construct( array $runs = array(), array $trashed = array(), private array $readings = array() ) {
		parent::__construct( 'bsbench_session', 'bsbench_', 'bsbench-session', 'bsbenchSessionId' );

		$this->runs    = array_column( $runs, null, 'id' );
		$this->trashed = array_column( $trashed, null, 'id' );
	}

	/**
	 * Lists the runs with a post status.
	 *
	 * @param string $status `publish` or `trash`.
	 * @return array<int, array<string, mixed>> The runs.
	 */
	public function all( string $status = 'publish' ): array {
		return array_values( 'trash' === $status ? $this->trashed : $this->runs );
	}

	/**
	 * Finds a recorded run.
	 *
	 * @param int $id The run id.
	 * @return array<string, mixed>|null The run.
	 */
	public function find( int $id ): ?array {
		return $this->runs[ $id ] ?? null;
	}

	/**
	 * Finds a trashed run.
	 *
	 * @param int $id The run id.
	 * @return array<string, mixed>|null The run.
	 */
	public function find_trashed( int $id ): ?array {
		return $this->trashed[ $id ] ?? null;
	}

	/**
	 * Reads a run's readings.
	 *
	 * @param int $id The run id.
	 * @return array<int, array<string, mixed>> The readings.
	 */
	public function readings( int $id ): array {
		return $this->readings[ $id ] ?? array();
	}

	/**
	 * Returns the last recorded run, standing in for the newest.
	 *
	 * @return array<string, mixed>|null The run.
	 */
	public function newest(): ?array {
		return array() === $this->runs ? null : end( $this->runs );
	}

	/**
	 * Moves a trashed run back among the recorded ones, as WordPress would.
	 *
	 * @param int $id The run id.
	 * @return bool Whether the run was in the trash.
	 */
	public function restore( int $id ): bool {
		if ( ! isset( $this->trashed[ $id ] ) ) {
			return false;
		}

		$this->runs[ $id ] = $this->trashed[ $id ];
		unset( $this->trashed[ $id ] );

		return true;
	}
}
