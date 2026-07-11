<?php
/**
 * Build-time CLI: compiles `includes/Services.php` into
 * `build/Services.compiled.php`, pre-resolving every `%token%` against the
 * registry built from `includes/Config.php`.
 *
 * Run as: `php bin/CompileContainer.php`
 *
 * This script never bootstraps WordPress. It defines a dummy `ABSPATH` so
 * the plugin's `defined( 'ABSPATH' ) || exit;` guards let its classes and
 * the `Config.php`/`Services.php` sources load outside WordPress, then
 * flattens the container definitions and writes the result to a plain PHP
 * file the bootstrap `require`s when present.
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
use ErdemBircan\BatterySurfBench\Registry;

define( 'ABSPATH', __DIR__ . '/' );

$root = dirname( __DIR__ );

require $root . '/vendor/autoload.php';

$registry = new Registry( require $root . '/includes/Config.php' );
$services = require $root . '/includes/Services.php';

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
	. " * Produced by bin/CompileContainer.php from includes/Services.php with\n"
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

echo "Compiled container definitions written to {$output_path}\n";
