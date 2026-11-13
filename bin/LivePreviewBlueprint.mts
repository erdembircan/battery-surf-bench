/**
 * The checks behind `pnpm blueprint:verify`: the rules a Live Preview blueprint
 * must meet for WordPress.org to offer it and for WordPress Playground to run
 * it. A blueprint that breaks them doesn't fail anywhere visible: WordPress.org
 * quietly drops it and the plugin page loses its Live Preview button. These
 * checks fail the build instead.
 *
 * The size limit mirrors WordPress.org's plugin importer, which skips a
 * blueprint over 100 KB. The blueprint must be a JSON object, the shape
 * Playground's own blueprint schema describes, and that schema checks the
 * rest of its shape. The blueprint must also install and
 * activate the plugin itself: WordPress.org adds that step to the copy it
 * serves, but the file carries its own so it also runs by itself, as when
 * Playground loads it with `?blueprint-url=` to try a change before release.
 */

import { validateBlueprint } from '@wp-playground/blueprints';

/** The largest blueprint WordPress.org imports, in bytes. */
export const BLUEPRINT_SIZE_LIMIT = 100 * 1024;

/**
 * Tells whether a value is a plain JSON object, not null or an array.
 *
 * @param value - The value to test.
 * @return True when the value is an object with string keys.
 */
function isRecord( value: unknown ): value is Record< string, unknown > {
	return (
		typeof value === 'object' && value !== null && ! Array.isArray( value )
	);
}

/**
 * Tells whether a blueprint step installs and activates the plugin from
 * WordPress.org.
 *
 * @param step       - One entry of the blueprint's `steps`.
 * @param pluginSlug - The slug the step must install.
 * @return True when the step is that install.
 */
function installsPlugin( step: unknown, pluginSlug: string ): boolean {
	if ( ! isRecord( step ) || step.step !== 'installPlugin' ) {
		return false;
	}

	const { pluginData, options } = step;

	return (
		isRecord( pluginData ) &&
		pluginData.resource === 'wordpress.org/plugins' &&
		pluginData.slug === pluginSlug &&
		isRecord( options ) &&
		options.activate === true
	);
}

/**
 * Checks a Live Preview blueprint against WordPress.org's rules and
 * Playground's blueprint schema.
 *
 * @param source     - The blueprint's JSON source, as stored in its file.
 * @param pluginSlug - The slug the blueprint must install and activate.
 * @return One message per problem found, or an empty list when the blueprint is valid.
 */
export function findBlueprintErrors(
	source: string,
	pluginSlug: string
): string[] {
	const problems: string[] = [];
	const bytes = new TextEncoder().encode( source ).length;

	if ( bytes > BLUEPRINT_SIZE_LIMIT ) {
		const kilobytes = ( bytes / 1024 ).toFixed( 1 );

		problems.push(
			`It is ${ kilobytes } KB, over WordPress.org's 100 KB limit for a blueprint.`
		);
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse( source );
	} catch ( error ) {
		const message =
			error instanceof Error ? error.message : String( error );

		problems.push( `It is not valid JSON: ${ message }` );

		return problems;
	}

	if ( ! isRecord( parsed ) ) {
		problems.push(
			'It must be a JSON object, the shape of a Playground blueprint.'
		);

		return problems;
	}

	const result = validateBlueprint( parsed );

	if ( ! result.valid ) {
		for ( const error of result.errors ?? [] ) {
			const where =
				typeof error.instancePath === 'string' &&
				error.instancePath !== ''
					? error.instancePath
					: 'the blueprint';
			const message = error.message ?? 'invalid';

			problems.push(
				`Playground's blueprint schema rejects ${ where }: ${ message }`
			);
		}
	}

	const hasSelfInstall =
		Array.isArray( parsed.steps ) &&
		parsed.steps.some( ( step ) => installsPlugin( step, pluginSlug ) );

	if ( ! hasSelfInstall ) {
		problems.push(
			`It has no installPlugin step that installs and activates ${ pluginSlug } from wordpress.org/plugins.`
		);
	}

	return problems;
}
