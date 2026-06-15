<?php
/**
 * Container not-found exception.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Container;

use InvalidArgumentException;
use Psr\Container\NotFoundExceptionInterface;

defined( 'ABSPATH' ) || exit;

/**
 * Thrown when a requested container entry does not exist.
 */
class NotFoundException extends InvalidArgumentException implements NotFoundExceptionInterface {
}
