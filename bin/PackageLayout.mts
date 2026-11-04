/**
 * Where the build puts the plugin and its zips, shared by every packaging step.
 *
 * `composer build:development` and `composer build:production` assemble the
 * plugin folder a site installs in `dist/battery-surf-bench/`, and
 * `composer zip:development` and `composer zip:production` compress it into
 * `zip/`. Each step takes the variant as `--development` or `--production`, so
 * one flag decides both what the build leaves in and which zip it writes. The
 * `archive:plugin` Composer script writes `ARCHIVE_FILE`, so the two names must
 * match.
 */

/** The plugin's slug: its folder name in the zip and in `wp-content/plugins/`. */
export const PLUGIN_SLUG = 'battery-surf-bench';

/** The two builds: development carries the dev-tools panel, production leaves it out. */
export type PackageVariant = 'development' | 'production';

/** Where the build assembles the plugin folder. */
export const DIST_DIR = 'dist';

/** The archive `composer archive` writes: the files `.gitattributes` lets through. */
export const ARCHIVE_FILE = `${ DIST_DIR }/${ PLUGIN_SLUG }-archive.zip`;

/** The assembled plugin folder a site installs. */
export const PLUGIN_DIR = `${ DIST_DIR }/${ PLUGIN_SLUG }`;

/** The dev-tools panel's PHP, which the production build leaves out of the plugin folder. */
export const DEV_TOOLS_SOURCE = 'includes/DevTools';

/**
 * Returns the zip a variant's build writes.
 *
 * @param variant - The build variant.
 * @return The zip's path, relative to the repository root.
 */
export function zipFileFor( variant: PackageVariant ): string {
	return variant === 'production'
		? `zip/${ PLUGIN_SLUG }.zip`
		: `zip/${ PLUGIN_SLUG }-development.zip`;
}

/**
 * Reads the build variant from a packaging step's command-line arguments.
 *
 * @param args - The arguments after the script path.
 * @return The variant, or null unless exactly one of `--development` and `--production` is present.
 */
export function variantFrom( args: readonly string[] ): PackageVariant | null {
	const development = args.includes( '--development' );
	const production = args.includes( '--production' );

	if ( development === production ) {
		return null;
	}

	return production ? 'production' : 'development';
}
