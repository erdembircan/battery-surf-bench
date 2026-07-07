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
 * Builds the Selected pane's rows from the order, resolving each bundled
 * entry's title from the catalog and each user entry's title and type badge
 * from the fetched post info — falling back to the raw slug/id while a user
 * page's info is still being resolved, so the row renders immediately instead
 * of waiting on the network.
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
			title: resolved?.title ?? `#${ entry.id }`,
			badge: resolved?.type === 'post' ? 'post' : 'page',
			removable: true,
			entry,
		};
	} );
}
