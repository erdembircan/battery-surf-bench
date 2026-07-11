<?php
/**
 * Build-time CLI: validates `includes/Services.php` against the registry
 * built from `includes/Config.php`, then — unless run with `--check` —
 * compiles it into `build/Services.compiled.php`, pre-resolving every
 * `%token%` and precomputing each class's build plan.
 *
 * Run as:
 * - `php bin/BuildContainer.php` — validates, then compiles and writes the
 *   artifact, then self-verifies the written file is loadable.
 * - `php bin/BuildContainer.php --check` — validates only; never compiles,
 *   never writes to `build/`. This is what CI runs: proving the recipes are
 *   structurally sound without producing (or needing to diff) a build
 *   artifact that is gitignored and regenerated on every real build anyway.
 *
 * This script never bootstraps WordPress. It defines a dummy `ABSPATH` so
 * the plugin's `defined( 'ABSPATH' ) || exit;` guards let its classes and
 * the `Config.php`/`Services.php` sources load outside WordPress. When
 * validation finds problems, the full list is printed to STDERR and nothing
 * is written: a broken recipe never reaches a compiled artifact, whether
 * checking or building. On a real (non-`--check`) build, the freshly
 * written artifact is `require`d back in this same process and asserted to
 * return an array — the builder owning its own output's validity, rather
 * than relying on an external `php -l` step.
 *
 * This file lives outside `includes/`, `src/` and `tests/` — the plugin's
 * shipped/tested source roots — so it is build tooling, not runtime code:
 * it is excluded from PHPCS's scanned paths and writes its output with
 * plain filesystem calls, the same way the project's other build tooling
 * (`wp-scripts`, the `wp-playground/*.mts` scripts) already writes to
 * `build/`.
 *
 * @package ErdemBircan\BatterySurfBench
 */

use ErdemBircan\BatterySurfBench\ContainerCompiler;
use ErdemBircan\BatterySurfBench\ContainerValidator;
use ErdemBircan\BatterySurfBench\Registry;

define( 'ABSPATH', __DIR__ . '/' );

$root       = dirname( __DIR__ );
$check_only = in_array( '--check', $argv, true );

require $root . '/vendor/autoload.php';

$registry = new Registry( require $root . '/includes/Config.php' );
$services = require $root . '/includes/Services.php';

$errors = ( new ContainerValidator() )->validate( $services, $registry );

if ( $errors ) {
	fwrite( STDERR, 'Container definition validation failed (' . count( $errors ) . " error(s)):\n" );

	foreach ( $errors as $i => $error ) {
		fwrite( STDERR, sprintf( "  %d. %s\n", $i + 1, $error ) );
	}

	exit( 1 );
}

if ( $check_only ) {
	echo "Container definitions valid.\n";
	exit( 0 );
}

$baked = ( new ContainerCompiler() )->compile( $services, $registry );

$build_dir = $root . '/build';

if ( ! is_dir( $build_dir ) ) {
	mkdir( $build_dir, 0755, true );
}

$output_path = $build_dir . '/Services.compiled.php';

$contents = "<?php\n"
	. "/**\n"
	. " * Generated container definitions — DO NOT EDIT.\n"
	. " *\n"
	. " * Produced by bin/BuildContainer.php from includes/Services.php with\n"
	. " * %token% specs flattened to their configuration values. Regenerated on\n"
	. " * build.\n"
	. " *\n"
	. " * @package ErdemBircan\\BatterySurfBench\n"
	. " */\n"
	. "\n"
	. "defined( 'ABSPATH' ) || exit;\n"
	. "\n"
	. 'return ' . var_export( $baked, true ) . ";\n";

file_put_contents( $output_path, $contents );

// Self-verify: the builder owns proving its own output is loadable, rather
// than leaning on a separate `php -l` step. A parse error in the written
// file would fatal loudly right here; this additionally confirms the file
// actually returns the expected shape.
$loaded = require $output_path;

if ( ! is_array( $loaded ) ) {
	fwrite( STDERR, "Self-verification failed: {$output_path} did not return an array.\n" );
	exit( 1 );
}

echo "Compiled container definitions written to {$output_path}\n";
