/**
 * Turns the PHP-supplied session field descriptors into DataViews fields.
 *
 * The shape of a session is defined once in PHP and localized to the screen, so
 * this builder stays generic: it maps each descriptor's display format to a
 * DataViews field type and renderer rather than naming any session field. The
 * field `id` is the dot-path into the REST record (`meta.<key>`), which lets
 * DataViews read, sort and filter the value with no per-field accessor.
 *
 * A few formats render richer cells — status as a coloured badge, battery levels
 * as a mini bar — using class names whose colours are CSS custom properties (see
 * `style.scss`), so a shared dashboard design system can later restyle them by
 * overriding those tokens rather than touching this file.
 */

import type { Field } from '@wordpress/dataviews';
import type { SessionFieldDescriptor, SessionRecord } from './Types';
import { formatUserAgent } from './UserAgent';

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
 * Formats a numeric value with its unit of measure. An absent value reads as an
 * em dash; when `optional`, a zero does too — the marker for a figure that does
 * not apply to the run or that a run could not measure (a target on a duration
 * run, a drain rate too short to compute). A genuine zero (a drop of 0%) keeps
 * its value when not `optional`.
 *
 * @param value    The raw meta value.
 * @param unit     The unit suffix to append (e.g. `%`, `%/h`).
 * @param optional Whether a zero should render as an em dash rather than `0`.
 * @return The value with its unit, or an em dash.
 */
function withUnit( value: unknown, unit: string, optional: boolean ): string {
	const num = Number( value );
	if ( ! Number.isFinite( num ) || ( optional && num <= 0 ) ) {
		return '—';
	}
	return `${ num }${ unit }`;
}

/**
 * Formats a duration in seconds (the stored base unit) as a human-readable span:
 * seconds under a minute (`45s`), minutes under an hour (`20m`), hours and
 * minutes above it (`8h 4m`, or just `8h` on the hour). An em dash marks the
 * not-applicable / unmeasurable case the cockpit stores as zero.
 *
 * @param value The raw seconds meta value.
 * @return The formatted duration, or an em dash when zero or absent.
 */
function asRuntime( value: unknown ): string {
	const raw = Number( value );
	if ( ! Number.isFinite( raw ) || raw <= 0 ) {
		return '—';
	}
	// Floor throughout, matching the cockpit's H:MM time-to-empty readout
	// (`formatTimeToEmpty`), so the same projection reads identically in the live
	// deck and in this listing rather than rounding up to the next minute.
	const seconds = Math.floor( raw );
	if ( seconds < 60 ) {
		return `${ seconds }s`;
	}
	const minutes = Math.floor( seconds / 60 );
	if ( minutes < 60 ) {
		return `${ minutes }m`;
	}
	const hours = Math.floor( minutes / 60 );
	const rest = minutes % 60;
	return rest > 0 ? `${ hours }h ${ rest }m` : `${ hours }h`;
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
 * Renders a session status as a coloured pill. The value drives the modifier
 * class (`bsb-badge--finished`, etc.) whose colours are themeable tokens.
 *
 * @param props            Render props.
 * @param props.value      The raw status meta value.
 * @param props.descriptor The status field descriptor (for the human label).
 * @return The badge element, or an em dash when the status is unset.
 */
function StatusBadge( {
	value,
	descriptor,
}: {
	value: unknown;
	descriptor: SessionFieldDescriptor;
} ) {
	const raw = value === undefined || value === null ? '' : String( value );
	if ( raw === '' ) {
		return <>—</>;
	}
	const label =
		descriptor.elements?.find( ( element ) => element.value === raw )
			?.label ?? raw;
	return (
		<span className={ `bsb-badge bsb-badge--${ raw }` }>
			<span className="bsb-badge__dot" aria-hidden="true" />
			{ label }
		</span>
	);
}

/**
 * Picks the fill tone for a battery percentage: high (healthy), mid (getting
 * low), or low (critical).
 *
 * @param pct The battery percentage, 0..100.
 * @return The tone modifier name.
 */
function levelTone( pct: number ): string {
	if ( pct >= 60 ) {
		return 'high';
	}
	if ( pct >= 25 ) {
		return 'mid';
	}
	return 'low';
}

/**
 * Renders a 0..1 battery level as a mini bar plus its percentage. The fill tone
 * (high/mid/low) is a themeable token so low charge reads at a glance.
 *
 * @param props       Render props.
 * @param props.value The raw 0..1 battery level.
 * @return The level element, or an em dash when absent.
 */
function LevelBar( { value }: { value: unknown } ) {
	const level = Number( value );
	if ( ! Number.isFinite( level ) ) {
		return <>—</>;
	}
	const pct = Math.max( 0, Math.min( 100, Math.round( level * 100 ) ) );
	const tone = levelTone( pct );
	return (
		<span className="bsb-level">
			<span className="bsb-level__track">
				<span
					className={ `bsb-level__fill bsb-level__fill--${ tone }` }
					style={ { width: `${ pct }%` } }
				/>
			</span>
			<span className="bsb-level__pct">{ pct }%</span>
		</span>
	);
}

/**
 * Builds the DataViews field for a single descriptor, choosing its type and
 * renderer from the descriptor's display format. Enumerated fields keep their
 * `elements` so DataViews still offers them as filters.
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
		base.elements = descriptor.elements;
		// Offer only the "is any of" operator so a filter maps cleanly to a
		// server-side `IN` over the chosen values (see SessionRestQuery).
		base.filterBy = { operators: [ 'isAny' ] };
	}

	switch ( descriptor.format ) {
		case 'status':
			return {
				...base,
				render: ( { item } ) => (
					<StatusBadge
						value={ metaValue( item, descriptor ) }
						descriptor={ descriptor }
					/>
				),
			};
		case 'datetime':
			return {
				...base,
				type: 'datetime',
				render: ( { item } ) => (
					<>{ asDateTime( metaValue( item, descriptor ) ) }</>
				),
			};
		case 'percent':
			// No DataViews `number` field type exists; leaving the type unset
			// gives a numeric sort for the raw 0..1 value while the bar renders
			// it visually.
			return {
				...base,
				render: ( { item } ) => (
					<LevelBar value={ metaValue( item, descriptor ) } />
				),
			};
		case 'percentText':
			return {
				...base,
				render: ( { item } ) => (
					<span className="bsb-num">
						{ withUnit(
							metaValue( item, descriptor ),
							'%',
							false
						) }
					</span>
				),
			};
		case 'percentOptional':
			return {
				...base,
				render: ( { item } ) => (
					<span className="bsb-num">
						{ withUnit( metaValue( item, descriptor ), '%', true ) }
					</span>
				),
			};
		case 'rate':
			return {
				...base,
				render: ( { item } ) => (
					<span className="bsb-num">
						{ withUnit(
							metaValue( item, descriptor ),
							'%/h',
							true
						) }
					</span>
				),
			};
		case 'runtime':
			return {
				...base,
				render: ( { item } ) => (
					<span className="bsb-num">
						{ asRuntime( metaValue( item, descriptor ) ) }
					</span>
				),
			};
		case 'browser':
			// The browser column reads the sibling version and OS meta too, so the
			// listing composes the discrete fields the session stores. Sorting
			// stays on this field's own key (the browser name).
			return {
				...base,
				render: ( { item } ) => <>{ formatUserAgent( item.meta ) }</>,
			};
		default:
			if ( descriptor.elements ) {
				return {
					...base,
					render: ( { item } ) => (
						<>
							{ asElementLabel(
								metaValue( item, descriptor ),
								descriptor
							) }
						</>
					),
				};
			}
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
		render: ( { item } ) => (
			<>{ item.title?.rendered || `#${ item.id }` }</>
		),
	};

	return [ title, ...descriptors.map( toField ) ];
}
