<?php
/**
 * Registry not-found exception.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Exception;

use InvalidArgumentException;
use Psr\Container\NotFoundExceptionInterface;

defined( 'ABSPATH' ) || exit;

/**
 * Thrown when a requested registry entry does not exist.
 */
class NotFoundException extends InvalidArgumentException implements NotFoundExceptionInterface {
}
