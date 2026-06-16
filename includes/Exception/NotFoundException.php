<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

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
