/**
 * Turns the PHP-supplied session field descriptors into DataViews fields.
 *
 * The shape of a session is defined once in PHP and localized to the screen, so
 * this builder stays generic: it maps each descriptor's display format to a
 * DataViews field type and renderer rather than naming any session field. The
 * field `id` is the dot-path into the REST record (`meta.<key>`), which lets
 * DataViews read, sort and filter the value with no per-field accessor.
 */

import type { Field } from '@wordpress/dataviews/wp';
import type { SessionFieldDescriptor, SessionRecord } from './Types';

/**
 * Reads a session's raw meta value for a descriptor.
 *
 * @param item       The session record.
 * @param descriptor The field descriptor naming the meta key.
 * @return The stored meta value, if any.
 */
function metaValue(
	item: SessionRecord,
	descriptor: SessionFieldDescriptor
): unknown {
	return item.meta?.[ descriptor.key ];
}

/**
 * Formats a 0..1 battery fraction as a whole percentage.
 *
 * @param value The raw meta value.
 * @return The formatted percentage, or an em dash when absent.
 */
function asPercent( value: unknown ): string {
	const level = Number( value );
	return Number.isFinite( level ) ? `${ Math.round( level * 100 ) }%` : '—';
}

/**
 * Formats a drain rate in percent per hour to two decimals.
 *
 * @param value The raw meta value.
 * @return The formatted rate, or an em dash when absent.
 */
function asRate( value: unknown ): string {
	const rate = Number( value );
	return Number.isFinite( rate ) ? rate.toFixed( 2 ) : '—';
}

/**
 * Formats a count of minutes as a compact hours-and-minutes duration.
 *
 * @param value The raw meta value.
 * @return The formatted duration, or an em dash when absent.
 */
function asMinutes( value: unknown ): string {
	const minutes = Number( value );
	if ( ! Number.isFinite( minutes ) || minutes <= 0 ) {
		return '—';
	}
	const hours = Math.floor( minutes / 60 );
	const rest = Math.round( minutes % 60 );
	return hours > 0 ? `${ hours }h ${ rest }m` : `${ rest }m`;
}

/**
 * Formats a stored datetime string for display in the viewer's locale.
 *
 * @param value The raw meta value.
 * @return The localized timestamp, or an em dash when absent or unparsable.
 */
function asDateTime( value: unknown ): string {
	if ( typeof value !== 'string' || value === '' ) {
		return '—';
	}
	const time = Date.parse( value.replace( ' ', 'T' ) );
	return Number.isNaN( time ) ? value : new Date( time ).toLocaleString();
}

/**
 * Resolves an enumerated value to its human label from the descriptor.
 *
 * @param value      The raw meta value.
 * @param descriptor The field descriptor carrying the elements.
 * @return The matching label, the raw value, or an em dash when absent.
 */
function asElementLabel(
	value: unknown,
	descriptor: SessionFieldDescriptor
): string {
	const raw = value === undefined || value === null ? '' : String( value );
	if ( raw === '' ) {
		return '—';
	}
	const match = descriptor.elements?.find(
		( element ) => element.value === raw
	);
	return match ? match.label : raw;
}

/**
 * Builds the DataViews field for a single descriptor, choosing its type and
 * renderer from the descriptor's display format.
 *
 * @param descriptor The PHP-supplied field descriptor.
 * @return The DataViews field.
 */
function toField( descriptor: SessionFieldDescriptor ): Field< SessionRecord > {
	const base: Field< SessionRecord > = {
		id: `meta.${ descriptor.key }`,
		label: descriptor.label,
		enableSorting: true,
	};

	if ( descriptor.elements ) {
		return {
			...base,
			elements: descriptor.elements,
			render: ( { item } ) =>
				asElementLabel( metaValue( item, descriptor ), descriptor ),
		};
	}

	switch ( descriptor.format ) {
		case 'datetime':
			return {
				...base,
				type: 'datetime',
				render: ( { item } ) =>
					asDateTime( metaValue( item, descriptor ) ),
			};
		case 'percent':
			// No DataViews `number` field type exists; leaving the type unset
			// gives a numeric sort for the raw 0..1 value while the renderer
			// shows it as a percentage.
			return {
				...base,
				render: ( { item } ) =>
					asPercent( metaValue( item, descriptor ) ),
			};
		case 'rate':
			return {
				...base,
				render: ( { item } ) => asRate( metaValue( item, descriptor ) ),
			};
		case 'minutes':
			return {
				...base,
				type: 'integer',
				render: ( { item } ) =>
					asMinutes( metaValue( item, descriptor ) ),
			};
		case 'integer':
			return { ...base, type: 'integer' };
		case 'object':
			return {
				...base,
				enableSorting: false,
				render: () => '—',
			};
		default:
			return { ...base, type: 'text' };
	}
}

/**
 * Builds every DataViews field from the localized descriptors, plus a leading
 * title field so each row is identifiable when sessions are untitled.
 *
 * @param descriptors The PHP-supplied field descriptors.
 * @return The DataViews fields for the listing.
 */
export function buildFields(
	descriptors: SessionFieldDescriptor[]
): Field< SessionRecord >[] {
	const title: Field< SessionRecord > = {
		id: 'title',
		label: 'Session',
		enableSorting: true,
		getValue: ( { item } ) => item.title?.rendered ?? `#${ item.id }`,
		render: ( { item } ) => item.title?.rendered || `#${ item.id }`,
	};

	return [ title, ...descriptors.map( toField ) ];
}
