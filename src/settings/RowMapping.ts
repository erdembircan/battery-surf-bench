/**
 * Maps the surf-course order into renderable Selected-pane rows.
 */

import { entryKey } from './Order';
import type {
	BundledCatalogEntry,
	OrderEntry,
	ResolvedUserPage,
	SequenceRow,
} from './Types';

/**
 * Placeholder title shown for a user entry whose title has not resolved:
 * neither the server-side seed (`config.userPages`) nor the client-side
 * resolver has produced one. Never the raw post id — a bare number reads as a
 * broken row rather than one still catching up.
 */
const UNRESOLVED_TITLE_PLACEHOLDER = '—';

/**
 * Builds the Selected pane's rows from the order, resolving each bundled
 * entry's title from the catalog and each user entry's title and type badge
 * from the resolved post info — falling back to the catalog slug for a bundled
 * entry the catalog doesn't (yet) know, or a neutral placeholder for a user
 * entry that has not resolved, so the row always renders something readable
 * immediately instead of waiting on the network or ever showing a raw id.
 *
 * @param order          The current surf-course order.
 * @param bundledCatalog The bundled catalog, keyed by slug for title lookups.
 * @param userPages      Resolved title/type for user pages fetched so far, keyed by post id.
 * @return The rows the Selected pane renders, in order.
 */
export function mapOrderToRows(
	order: OrderEntry[],
	bundledCatalog: BundledCatalogEntry[],
	userPages: Record< number, ResolvedUserPage >
): SequenceRow[] {
	const catalogBySlug = new Map(
		bundledCatalog.map( ( page ) => [ page.slug, page.title ] )
	);

	return order.map( ( entry ) => {
		if ( entry.kind === 'bundled' ) {
			return {
				key: entryKey( entry ),
				title: catalogBySlug.get( entry.slug ) ?? entry.slug,
				badge: 'bundled',
				removable: false,
				entry,
			};
		}

		const resolved = userPages[ entry.id ];

		return {
			key: entryKey( entry ),
			title: resolved?.title ?? UNRESOLVED_TITLE_PLACEHOLDER,
			badge: resolved?.type === 'post' ? 'post' : 'page',
			removable: true,
			entry,
		};
	} );
}
